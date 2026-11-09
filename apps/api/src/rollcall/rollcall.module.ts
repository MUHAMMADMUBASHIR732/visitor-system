import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.module';
import { Auth, AuthUser, CurrentUser } from '../common/auth';
import { DB, Database } from '../db/db.module';
import { rollCallEntries, rollCalls, users, visitors, visits } from '../db/schema';
import { RealtimeService } from '../realtime/realtime.module';

export class StartRollCallDto {
  @IsOptional() @IsString() @MaxLength(200)
  reason?: string;
}

/**
 * Emergency roll call. Starting one freezes the list of everyone currently inside,
 * so guards can mark each person safe at the assembly point and see who is missing.
 */
@Injectable()
export class RollCallService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  private async activeCall() {
    const [call] = await this.db.select().from(rollCalls).where(isNull(rollCalls.endedAt)).limit(1);
    return call ?? null;
  }

  private async snapshot(callId: string) {
    const [call] = await this.db.select().from(rollCalls).where(eq(rollCalls.id, callId)).limit(1);
    if (!call) throw new NotFoundException('Roll call not found.');

    const rows = await this.db
      .select({
        entryId: rollCallEntries.id,
        safeAt: rollCallEntries.safeAt,
        visitId: visits.id,
        badgeNumber: visits.badgeNumber,
        checkInAt: visits.checkInAt,
        fullName: visitors.fullName,
        phone: visitors.phone,
        company: visitors.company,
        photo: visits.entryPhotoUrl,
        hostName: users.name,
        hostPhone: users.phone,
      })
      .from(rollCallEntries)
      .innerJoin(visits, eq(rollCallEntries.visitId, visits.id))
      .innerJoin(visitors, eq(visits.visitorId, visitors.id))
      .innerJoin(users, eq(visits.hostId, users.id))
      .where(eq(rollCallEntries.rollCallId, callId))
      .orderBy(asc(visitors.fullName));

    const safe = rows.filter((r) => r.safeAt).length;
    return {
      id: call.id,
      reason: call.reason,
      startedAt: call.startedAt.toISOString(),
      endedAt: call.endedAt?.toISOString() ?? null,
      total: rows.length,
      safe,
      missing: rows.length - safe,
      entries: rows.map((r) => ({
        ...r,
        safeAt: r.safeAt?.toISOString() ?? null,
        checkInAt: r.checkInAt?.toISOString() ?? null,
      })),
    };
  }

  async active() {
    const call = await this.activeCall();
    return call ? this.snapshot(call.id) : null;
  }

  async start(user: AuthUser, reason?: string) {
    if (await this.activeCall()) {
      throw new ConflictException('A roll call is already running. Finish it before starting another.');
    }
    const inside = await this.db.select({ id: visits.id }).from(visits).where(eq(visits.status, 'CHECKED_IN'));

    const [call] = await this.db
      .insert(rollCalls)
      .values({ reason: reason?.trim() || null, startedById: user.id })
      .returning({ id: rollCalls.id });
    if (inside.length > 0) {
      await this.db.insert(rollCallEntries).values(inside.map((v) => ({ rollCallId: call.id, visitId: v.id })));
    }
    const snap = await this.snapshot(call.id);
    this.realtime.emitToAll('rollcall.started', snap);
    await this.audit.log(user.id, 'rollcall.start', 'roll_call', call.id, { people: inside.length });
    return snap;
  }

  async mark(user: AuthUser, entryId: string, safe: boolean) {
    const [entry] = await this.db
      .select({ id: rollCallEntries.id, rollCallId: rollCallEntries.rollCallId })
      .from(rollCallEntries)
      .innerJoin(rollCalls, eq(rollCallEntries.rollCallId, rollCalls.id))
      .where(and(eq(rollCallEntries.id, entryId), isNull(rollCalls.endedAt)))
      .limit(1);
    if (!entry) throw new NotFoundException('This roll call has already ended.');

    await this.db
      .update(rollCallEntries)
      .set({ safeAt: safe ? new Date() : null, markedById: safe ? user.id : null })
      .where(eq(rollCallEntries.id, entryId));
    const snap = await this.snapshot(entry.rollCallId);
    this.realtime.emitToGate('rollcall.updated', snap);
    return snap;
  }

  async end(user: AuthUser) {
    const call = await this.activeCall();
    if (!call) throw new NotFoundException('No roll call is running.');
    await this.db.update(rollCalls).set({ endedAt: new Date(), endedById: user.id }).where(eq(rollCalls.id, call.id));
    const snap = await this.snapshot(call.id);
    this.realtime.emitToAll('rollcall.ended', snap);
    await this.audit.log(user.id, 'rollcall.end', 'roll_call', call.id, { missing: snap.missing });
    return snap;
  }
}

@Controller('roll-call')
export class RollCallController {
  constructor(private readonly service: RollCallService) {}

  /** Everyone can see that a roll call is running (hosts get a banner). */
  @Get('active')
  @Auth()
  active() {
    return this.service.active();
  }

  @Post('start')
  @Auth('GUARD', 'ADMIN')
  start(@CurrentUser() user: AuthUser, @Body() dto: StartRollCallDto) {
    return this.service.start(user, dto.reason);
  }

  @Post('entries/:id/safe')
  @Auth('GUARD', 'ADMIN')
  @HttpCode(200)
  safe(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.mark(user, id, true);
  }

  @Post('entries/:id/undo')
  @Auth('GUARD', 'ADMIN')
  @HttpCode(200)
  undo(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.mark(user, id, false);
  }

  @Post('end')
  @Auth('GUARD', 'ADMIN')
  @HttpCode(200)
  end(@CurrentUser() user: AuthUser) {
    return this.service.end(user);
  }
}

@Module({ controllers: [RollCallController], providers: [RollCallService] })
export class RollCallModule {}
