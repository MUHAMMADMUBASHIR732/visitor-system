import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { memoryStorage } from 'multer';
import { AuditService } from '../audit/audit.module';
import { Auth, AuthUser, CurrentUser } from '../common/auth';
import { BlacklistModule, BlacklistService } from '../blacklist/blacklist.module';
import { visits } from '../db/schema';
import { InboxService } from '../inbox/inbox.module';
import { NotificationsService } from '../notifications/notifications.module';
import { PassService } from '../pass/pass.module';
import { RealtimeService } from '../realtime/realtime.module';
import { StorageService } from '../storage/storage.module';
import { CheckInDto, ScanDto, WalkInDto } from '../visits/visits.dto';
import { VisitsModule } from '../visits/visits.controller';
import { VisitsService } from '../visits/visits.service';
import { SerializedVisit, VisitRow } from '../visits/visit.types';

export type Verdict = 'ALLOW' | 'ALREADY_INSIDE' | 'WAIT' | 'DENY';

export interface ScanResult {
  verdict: Verdict;
  reason: string | null;
  visit: SerializedVisit;
}

@Injectable()
export class GateService {
  constructor(
    private readonly visits: VisitsService,
    private readonly blacklist: BlacklistService,
    private readonly pass: PassService,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly inbox: InboxService,
    private readonly audit: AuditService,
  ) {}

  private fmt(d: Date) {
    return d.toLocaleString('en-GB', { timeZone: this.visits.tz, dateStyle: 'medium', timeStyle: 'short' });
  }

  /** Decide what the guard should do with this visit right now. */
  private async judge(row: VisitRow): Promise<{ verdict: Verdict; reason: string | null }> {
    const { visit, visitor } = row;

    const blocked = await this.blacklist.findMatch({ phone: visitor.phone, idNumber: visitor.idNumber });
    if (blocked) {
      return { verdict: 'DENY', reason: `Blacklisted: ${blocked.reason}. Do not admit; contact security.` };
    }

    switch (visit.status) {
      case 'CHECKED_IN':
        return { verdict: 'ALREADY_INSIDE', reason: 'This visitor is already inside. Check out when they leave.' };
      case 'CHECKED_OUT':
        return { verdict: 'DENY', reason: 'This pass was already used and the visitor checked out.' };
      case 'CANCELLED':
        return { verdict: 'DENY', reason: 'The host cancelled this visit.' };
      case 'REJECTED':
        return { verdict: 'DENY', reason: 'The host declined this visit.' };
      case 'NO_SHOW':
        return { verdict: 'DENY', reason: 'This pass expired before the visitor arrived.' };
      case 'PENDING_APPROVAL':
        return { verdict: 'WAIT', reason: `Waiting for ${row.host.name} to approve this walk-in.` };
      case 'SCHEDULED':
      case 'APPROVED': {
        const now = Date.now();
        const opensAt = visit.expectedFrom.getTime() - this.visits.earlyMinutes * 60_000;
        if (now < opensAt) {
          return { verdict: 'DENY', reason: `Too early. This pass works from ${this.fmt(new Date(opensAt))}.` };
        }
        if (now > visit.expectedTo.getTime()) {
          return { verdict: 'DENY', reason: `This pass expired at ${this.fmt(visit.expectedTo)}.` };
        }
        return { verdict: 'ALLOW', reason: null };
      }
    }
  }

  async scan(user: AuthUser, dto: ScanDto): Promise<ScanResult> {
    let row: VisitRow | undefined;

    if (dto.token) {
      const parsed = this.pass.verify(dto.token);
      if (!parsed) throw new BadRequestException('This QR code is not a valid Foyer pass.');
      row = await this.visits.getRow(parsed.visitId).catch(() => undefined);
      if (!row) throw new NotFoundException('No visit matches this pass.');
    } else if (dto.code) {
      // Codes are unique among open passes, so no time filter is needed here:
      // judge() explains "too early" instead of pretending the code does not exist.
      const [found] = await this.visits
        .baseSelect()
        .where(
          and(
            eq(visits.passCode, dto.code),
            inArray(visits.status, ['SCHEDULED', 'APPROVED', 'PENDING_APPROVAL', 'CHECKED_IN']),
            gte(visits.expectedTo, new Date()),
          ),
        )
        .orderBy(asc(visits.expectedFrom))
        .limit(1);
      row = found;
      if (!row) throw new NotFoundException('No active visit has this code.');
    } else {
      throw new BadRequestException('Scan a QR code or enter the 6-digit code.');
    }

    const { verdict, reason } = await this.judge(row);
    if (verdict === 'DENY') {
      await this.audit.log(user.id, 'gate.scan.denied', 'visit', row.visit.id, { reason });
    }
    return { verdict, reason, visit: this.visits.serialize(row) };
  }

  async checkIn(user: AuthUser, id: string, dto: CheckInDto, photo?: Express.Multer.File) {
    const row = await this.visits.getRow(id);
    const { verdict, reason } = await this.judge(row);
    if (verdict !== 'ALLOW') throw new ConflictException(reason ?? 'This visitor cannot be checked in.');

    const photoUrl = photo ? await this.storage.saveImage(photo.buffer) : null;

    const [{ n }] = (await this.visits.db.execute(sql`select nextval('badge_seq')::int as n`)).rows as { n: number }[];
    const badge = `V-${String(n).padStart(4, '0')}`;

    // The status condition makes this atomic: two guards scanning at once cannot both succeed.
    const updated = await this.visits.db
      .update(visits)
      .set({
        status: 'CHECKED_IN',
        checkInAt: new Date(),
        checkedInById: user.id,
        entryPhotoUrl: photoUrl,
        badgeNumber: badge,
        vehiclePlate: dto.vehiclePlate?.trim().toUpperCase() || row.visit.vehiclePlate,
      })
      .where(and(eq(visits.id, id), inArray(visits.status, ['SCHEDULED', 'APPROVED'])))
      .returning({ id: visits.id });
    if (updated.length === 0) {
      await this.storage.remove(photoUrl);
      throw new ConflictException('This visitor was already checked in.');
    }

    const serialized = await this.visits.serializedById(id);
    this.realtime.emitToHost(serialized.host.id, 'visit.checked_in', serialized);
    this.realtime.emitToGate('visit.checked_in', serialized);
    void this.inbox.visitEvent(serialized, 'arrived');
    await this.audit.log(user.id, 'gate.check_in', 'visit', id, { badge });
    return serialized;
  }

  async checkOut(user: AuthUser, id: string) {
    const updated = await this.visits.db
      .update(visits)
      .set({ status: 'CHECKED_OUT', checkOutAt: new Date(), checkedOutById: user.id })
      .where(and(eq(visits.id, id), eq(visits.status, 'CHECKED_IN')))
      .returning({ id: visits.id });
    if (updated.length === 0) throw new ConflictException('This visitor is not checked in.');

    const serialized = await this.visits.serializedById(id);
    this.realtime.emitToHost(serialized.host.id, 'visit.checked_out', serialized);
    this.realtime.emitToGate('visit.checked_out', serialized);
    void this.inbox.visitEvent(serialized, 'left');
    await this.audit.log(user.id, 'gate.check_out', 'visit', id);
    return serialized;
  }

  async walkIn(user: AuthUser, dto: WalkInDto) {
    await this.visits.assertActiveHost(dto.hostId);
    await this.visits.assertNotBlacklisted({ phone: dto.visitor.phone, idNumber: dto.visitor.idNumber });
    const visitor = await this.visits.upsertVisitor(dto.visitor);

    const now = new Date();
    const [created] = await this.visits.db
      .insert(visits)
      .values({
        visitorId: visitor.id,
        hostId: dto.hostId,
        purpose: dto.purpose.trim(),
        status: 'PENDING_APPROVAL',
        isWalkIn: true,
        expectedFrom: now,
        expectedTo: new Date(now.getTime() + 12 * 3600_000),
        passCode: await this.visits.newPassCode(),
        vehiclePlate: dto.vehiclePlate?.trim().toUpperCase() || null,
      })
      .returning({ id: visits.id });

    const serialized = await this.visits.serializedById(created.id);
    this.realtime.emitToHost(dto.hostId, 'walkin.pending', serialized);
    this.notifications.hostWalkIn(serialized);
    await this.audit.log(user.id, 'gate.walk_in', 'visit', created.id);
    return serialized;
  }

  async inside() {
    const rows = await this.visits.baseSelect().where(eq(visits.status, 'CHECKED_IN')).orderBy(asc(visits.checkInAt));
    return rows.map((r) => this.visits.serialize(r));
  }
}

@Controller('gate')
@Auth('GUARD', 'ADMIN')
export class GateController {
  constructor(private readonly gate: GateService) {}

  @Post('scan')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  scan(@CurrentUser() user: AuthUser, @Body() dto: ScanDto) {
    return this.gate.scan(user, dto);
  }

  @Post('check-in/:id')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } }))
  checkIn(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.gate.checkIn(user, id, dto, photo);
  }

  @Post('check-out/:id')
  checkOut(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gate.checkOut(user, id);
  }

  @Post('walk-in')
  walkIn(@CurrentUser() user: AuthUser, @Body() dto: WalkInDto) {
    return this.gate.walkIn(user, dto);
  }

  @Get('inside')
  inside() {
    return this.gate.inside();
  }
}

@Module({
  imports: [VisitsModule, BlacklistModule],
  controllers: [GateController],
  providers: [GateService],
})
export class GateModule {}
