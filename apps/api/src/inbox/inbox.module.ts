import { Body, Controller, Get, Global, Inject, Injectable, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Auth, AuthUser, CurrentUser } from '../common/auth';
import { SERVERLESS } from '../common/runtime';
import { ScopeService } from '../common/scope.module';
import { DB, Database } from '../db/db.module';
import { notifications } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.module';
import { RealtimeService } from '../realtime/realtime.module';
import type { SerializedVisit } from '../visits/visit.types';

@Injectable()
export class InboxService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly scope: ScopeService,
    private readonly realtime: RealtimeService,
    private readonly mail: NotificationsService,
  ) {}

  /**
   * A visitor arrived or left: tell the host, the host's manager and the senior manager above them.
   * Never throws, so a notification problem cannot block the front desk.
   */
  async visitEvent(visit: SerializedVisit, kind: 'arrived' | 'left') {
    try {
      const chain = await this.scope.chainOf(visit.host.id);
      const mails: Promise<void>[] = [];
      const who = visit.visitor.fullName + (visit.visitor.company ? ` (${visit.visitor.company})` : '');
      for (const person of chain) {
        const isHost = person.id === visit.host.id;
        const title = kind === 'arrived' ? `${visit.visitor.fullName} has arrived` : `${visit.visitor.fullName} has left`;
        const body = isHost
          ? `${who} ${kind === 'arrived' ? 'checked in at reception' : 'checked out'}. Purpose: ${visit.purpose}.`
          : `${who} ${kind === 'arrived' ? 'arrived to see' : 'left after seeing'} ${visit.host.name}. Purpose: ${visit.purpose}.`;
        const [row] = await this.db
          .insert(notifications)
          .values({ userId: person.id, kind: `visit.${kind}`, title, body, visitId: visit.id })
          .returning();
        this.realtime.emitToUser(person.id, 'notification', row);
        mails.push(this.mail.simple(person.email, title, body));
      }
      if (SERVERLESS) await Promise.all(mails);
    } catch {
      // Best effort by design.
    }
  }

  async list(user: AuthUser) {
    const [items, [{ unread }]] = await Promise.all([
      this.db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(30),
      this.db
        .select({ unread: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    ]);
    return { items, unread };
  }

  async readAll(user: AuthUser) {
    await this.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return { ok: true };
  }

  async readOne(user: AuthUser, id: string) {
    await this.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
    return { ok: true };
  }
}

@Controller('notifications')
@Auth()
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.inbox.list(user);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.inbox.readAll(user);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.inbox.readOne(user, id);
  }
}

@Global()
@Module({ controllers: [InboxController], providers: [InboxService], exports: [InboxService] })
export class InboxModule {}
