import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { and, desc, asc, eq, gte, ilike, inArray, lt, or, sql, SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.module';
import { AuthUser } from '../common/auth';
import { escapeLike, normalizeIdNumber, normalizePhone } from '../common/normalize';
import { DB, Database } from '../db/db.module';
import { HOST_ROLES, users, visitors, visits, VisitStatus, VISIT_STATUSES } from '../db/schema';
import { ScopeService } from '../common/scope.module';
import { TasksService } from '../tasks/tasks.module';
import { BlacklistService } from '../blacklist/blacklist.module';
import { NotificationsService } from '../notifications/notifications.module';
import { PassService } from '../pass/pass.module';
import { RealtimeService } from '../realtime/realtime.module';
import { CreateVisitDto, ListVisitsDto, VisitorInput } from './visits.dto';
import { SerializedVisit, VisitRow } from './visit.types';

const OPEN_STATUSES: VisitStatus[] = ['SCHEDULED', 'APPROVED', 'PENDING_APPROVAL', 'CHECKED_IN'];

@Injectable()
export class VisitsService {
  readonly tz: string;
  readonly earlyMinutes: number;

  constructor(
    @Inject(DB) readonly db: Database,
    config: ConfigService,
    private readonly audit: AuditService,
    private readonly blacklist: BlacklistService,
    private readonly notifications: NotificationsService,
    private readonly pass: PassService,
    private readonly realtime: RealtimeService,
    private readonly scope: ScopeService,
    private readonly tasks: TasksService,
  ) {
    this.tz = config.get<string>('OFFICE_TIMEZONE') ?? 'Asia/Karachi';
    this.earlyMinutes = Number(config.get('QR_EARLY_MINUTES') ?? 60);
  }

  // ---------- shared building blocks (also used by GateService) ----------

  baseSelect() {
    return this.db
      .select({
        visit: visits,
        visitor: visitors,
        host: { id: users.id, name: users.name, email: users.email, phone: users.phone },
      })
      .from(visits)
      .innerJoin(visitors, eq(visits.visitorId, visitors.id))
      .innerJoin(users, eq(visits.hostId, users.id));
  }

  async getRow(id: string): Promise<VisitRow> {
    const [row] = await this.baseSelect().where(eq(visits.id, id)).limit(1);
    if (!row) throw new NotFoundException('Visit not found.');
    return row;
  }

  serialize(row: VisitRow): SerializedVisit {
    const { visit, visitor, host } = row;
    const canHavePass = !visit.isWalkIn && (visit.status === 'SCHEDULED' || visit.status === 'APPROVED');
    return {
      id: visit.id,
      status: visit.status,
      purpose: visit.purpose,
      isWalkIn: visit.isWalkIn,
      expectedFrom: visit.expectedFrom.toISOString(),
      expectedTo: visit.expectedTo.toISOString(),
      passCode: visit.passCode,
      passToken: canHavePass ? this.pass.sign(visit.id, visit.expectedTo) : null,
      checkInAt: visit.checkInAt?.toISOString() ?? null,
      checkOutAt: visit.checkOutAt?.toISOString() ?? null,
      entryPhotoUrl: visit.entryPhotoUrl,
      badgeNumber: visit.badgeNumber,
      vehiclePlate: visit.vehiclePlate,
      createdAt: visit.createdAt.toISOString(),
      visitor: {
        id: visitor.id,
        fullName: visitor.fullName,
        phone: visitor.phone,
        email: visitor.email,
        company: visitor.company,
        idType: visitor.idType,
        idNumber: visitor.idNumber,
      },
      host,
    };
  }

  async serializedById(id: string) {
    return this.serialize(await this.getRow(id));
  }

  async upsertVisitor(input: VisitorInput) {
    const phone = normalizePhone(input.phone);
    const idNumber = input.idNumber?.trim() ? normalizeIdNumber(input.idNumber) : null;
    const [existing] = await this.db.select().from(visitors).where(eq(visitors.phone, phone)).limit(1);
    if (existing) {
      const [updated] = await this.db
        .update(visitors)
        .set({
          fullName: input.fullName.trim(),
          email: input.email?.trim().toLowerCase() || existing.email,
          company: input.company?.trim() || existing.company,
          idType: input.idType?.trim() || existing.idType,
          idNumber: idNumber ?? existing.idNumber,
        })
        .where(eq(visitors.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await this.db
      .insert(visitors)
      .values({
        fullName: input.fullName.trim(),
        phone,
        email: input.email?.trim().toLowerCase() || null,
        company: input.company?.trim() || null,
        idType: input.idType?.trim() || null,
        idNumber,
      })
      .returning();
    return created;
  }

  /** Returning visitors: lets the form autofill from a phone number. Never exposes ID numbers. */
  async lookupVisitor(phoneRaw: string) {
    const phone = normalizePhone(phoneRaw);
    if (phone.replace(/\D/g, '').length < 7) return null;
    const [found] = await this.db.select().from(visitors).where(eq(visitors.phone, phone)).limit(1);
    if (!found) return null;
    const [stats] = await this.db
      .select({ count: sql<number>`count(*)::int`, last: sql<Date | string | null>`max(${visits.expectedFrom})` })
      .from(visits)
      .where(eq(visits.visitorId, found.id));
    return {
      fullName: found.fullName,
      phone: found.phone,
      email: found.email,
      company: found.company,
      idType: found.idType,
      visits: stats.count,
      lastVisitAt: stats.last ? new Date(stats.last).toISOString() : null,
    };
  }

  /** A 6-digit code the guard can type if a QR code cannot be scanned. Unique among open visits. */
  async newPassCode(): Promise<string> {
    for (let i = 0; i < 12; i++) {
      const code = String(randomInt(100000, 1000000));
      const [clash] = await this.db
        .select({ id: visits.id })
        .from(visits)
        .where(and(eq(visits.passCode, code), inArray(visits.status, OPEN_STATUSES), gte(visits.expectedTo, new Date())))
        .limit(1);
      if (!clash) return code;
    }
    throw new ConflictException('Could not create a pass code. Try again.');
  }

  async assertNotBlacklisted(input: { phone: string; idNumber?: string | null }) {
    const match = await this.blacklist.findMatch(input);
    if (match) {
      throw new BadRequestException('This visitor cannot be registered. Contact security for details.');
    }
  }

  async assertActiveHost(hostId: string) {
    const [host] = await this.db
      .select({ id: users.id, isActive: users.isActive, role: users.role })
      .from(users)
      .where(eq(users.id, hostId))
      .limit(1);
    if (!host || !host.isActive || !HOST_ROLES.includes(host.role)) {
      throw new BadRequestException('Choose an active host to visit.');
    }
  }

  async assertCanSee(user: AuthUser, row: VisitRow) {
    if (!(await this.scope.canSee(user, row.visit.hostId))) {
      throw new ForbiddenException('This visit belongs to someone outside your team.');
    }
  }

  // ---------- host-facing operations ----------

  async create(user: AuthUser, dto: CreateVisitDto) {
    const hostId = dto.hostId ?? user.id;
    if (hostId !== user.id && !(await this.scope.canSee(user, hostId))) {
      throw new ForbiddenException('You can only invite visitors for people on your team.');
    }
    await this.assertActiveHost(hostId);

    const from = new Date(dto.expectedFrom);
    const to = new Date(dto.expectedTo);
    if (to <= from) throw new BadRequestException('The end time must be after the start time.');
    if (to <= new Date()) throw new BadRequestException('The visit window has already passed.');
    if (to.getTime() - from.getTime() > 31 * 24 * 3600 * 1000) {
      throw new BadRequestException('A pass can last at most 31 days.');
    }

    await this.assertNotBlacklisted({ phone: dto.visitor.phone, idNumber: dto.visitor.idNumber });
    const visitor = await this.upsertVisitor(dto.visitor);
    const passCode = await this.newPassCode();

    const [created] = await this.db
      .insert(visits)
      .values({
        visitorId: visitor.id,
        hostId,
        purpose: dto.purpose.trim(),
        status: 'SCHEDULED',
        expectedFrom: from,
        expectedTo: to,
        passCode,
        vehiclePlate: dto.vehiclePlate?.trim().toUpperCase() || null,
      })
      .returning({ id: visits.id });

    const serialized = await this.serializedById(created.id);
    await this.notifications.inviteVisitor(serialized);
    this.realtime.emitToGate('visit.scheduled', serialized);
    await this.audit.log(user.id, 'visit.create', 'visit', created.id, { hostId });
    return serialized;
  }

  async list(user: AuthUser, q: ListVisitsDto) {
    const conds: SQL[] = [];
    const ids = await this.scope.visibleUserIds(user);
    if (ids) conds.push(inArray(visits.hostId, ids));
    if (q.hostId) conds.push(eq(visits.hostId, q.hostId));
    if (q.status) {
      const wanted = q.status
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is VisitStatus => (VISIT_STATUSES as readonly string[]).includes(s));
      if (wanted.length === 0) throw new BadRequestException('Unknown status filter.');
      conds.push(inArray(visits.status, wanted));
    }
    if (q.from) conds.push(gte(visits.expectedFrom, new Date(q.from)));
    if (q.to) conds.push(lt(visits.expectedFrom, new Date(q.to)));
    if (q.q?.trim()) {
      const like = `%${escapeLike(q.q.trim())}%`;
      conds.push(
        or(ilike(visitors.fullName, like), ilike(visitors.phone, like), ilike(visitors.company, like), ilike(users.name, like))!,
      );
    }
    const where = conds.length ? and(...conds) : undefined;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const [rows, [{ count }]] = await Promise.all([
      this.baseSelect()
        .where(where)
        .orderBy(q.order === 'asc' ? asc(visits.expectedFrom) : desc(visits.expectedFrom))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(visits)
        .innerJoin(visitors, eq(visits.visitorId, visitors.id))
        .innerJoin(users, eq(visits.hostId, users.id))
        .where(where),
    ]);
    return { items: rows.map((r) => this.serialize(r)), total: count, page, pageSize };
  }

  async findOne(user: AuthUser, id: string) {
    const row = await this.getRow(id);
    await this.assertCanSee(user, row);
    return this.serialize(row);
  }

  async cancel(user: AuthUser, id: string) {
    const row = await this.getRow(id);
    await this.assertCanSee(user, row);
    const updated = await this.db
      .update(visits)
      .set({ status: 'CANCELLED' })
      .where(and(eq(visits.id, id), inArray(visits.status, ['SCHEDULED', 'APPROVED', 'PENDING_APPROVAL'])))
      .returning({ id: visits.id });
    if (updated.length === 0) throw new ConflictException('This visit can no longer be cancelled.');
    const serialized = await this.serializedById(id);
    this.realtime.emitToGate('visit.cancelled', serialized);
    await this.audit.log(user.id, 'visit.cancel', 'visit', id);
    return serialized;
  }

  /** Host decision on a walk-in. */
  async decide(user: AuthUser, id: string, decision: 'APPROVED' | 'REJECTED') {
    const row = await this.getRow(id);
    await this.assertCanSee(user, row);
    const updated = await this.db
      .update(visits)
      .set({ status: decision })
      .where(and(eq(visits.id, id), eq(visits.status, 'PENDING_APPROVAL')))
      .returning({ id: visits.id });
    if (updated.length === 0) throw new ConflictException('This visit is not waiting for approval.');
    const serialized = await this.serializedById(id);
    this.realtime.emitToGate(decision === 'APPROVED' ? 'walkin.approved' : 'walkin.rejected', serialized);
    this.realtime.emitToHost(serialized.host.id, 'visit.updated', serialized);
    await this.audit.log(user.id, decision === 'APPROVED' ? 'walkin.approve' : 'walkin.reject', 'visit', id);
    return serialized;
  }

  async resendInvite(user: AuthUser, id: string) {
    const row = await this.getRow(id);
    await this.assertCanSee(user, row);
    const serialized = this.serialize(row);
    if (!serialized.passToken) throw new ConflictException('This visit has no active pass to send.');
    if (!serialized.visitor.email) throw new BadRequestException('Add the visitor’s email before sending the pass.');
    await this.notifications.inviteVisitor(serialized);
    await this.audit.log(user.id, 'visit.resend', 'visit', id);
    return { sent: true };
  }

  /** Counts for the dashboards. Hosts only see their own visits. */
  async summary(user: AuthUser) {
    await this.tasks.maybeSweep();
    const scope = await this.scope.hostFilter(user);
    const result = await this.db.execute(sql`
      with bounds as (
        select (date_trunc('day', now() at time zone ${this.tz}) at time zone ${this.tz}) as day_start
      )
      select
        count(*) filter (where status in ('SCHEDULED','APPROVED')
          and expected_from >= b.day_start and expected_from < b.day_start + interval '1 day')::int as expected_today,
        count(*) filter (where status = 'CHECKED_IN')::int as inside_now,
        count(*) filter (where status = 'CHECKED_OUT' and check_out_at >= b.day_start)::int as completed_today,
        count(*) filter (where status = 'PENDING_APPROVAL')::int as pending_approval
      from visits, bounds b
      where true ${scope}
    `);
    const r = result.rows[0] as Record<string, number>;
    return {
      expectedToday: r.expected_today,
      insideNow: r.inside_now,
      completedToday: r.completed_today,
      pendingApproval: r.pending_approval,
    };
  }
}
