import { Inject, Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import { DB, Database } from '../db/db.module';
import { visitors, visits } from '../db/schema';
import { RealtimeService } from '../realtime/realtime.module';

@Injectable()
export class TasksService {
  private readonly logger = new Logger('Tasks');

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly realtime: RealtimeService,
  ) {}

  /** Passes whose window ended without a check-in become no-shows. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireUnusedPasses() {
    try {
      const expired = await this.db
        .update(visits)
        .set({ status: 'NO_SHOW' })
        .where(and(inArray(visits.status, ['SCHEDULED', 'APPROVED', 'PENDING_APPROVAL']), lt(visits.expectedTo, new Date())))
        .returning({ id: visits.id });
      if (expired.length > 0) {
        this.logger.log(`Marked ${expired.length} unused pass(es) as no-show.`);
        this.realtime.emitToGate('visits.expired', { count: expired.length });
      }
    } catch (err) {
      this.logger.warn(`expireUnusedPasses failed: ${(err as Error).message}`);
    }
  }

  /** Visitors still inside 30 minutes after their window ended. Guards see an alert. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async flagOverdue() {
    try {
      const overdue = await this.db
        .select({ id: visits.id, name: visitors.fullName, badge: visits.badgeNumber })
        .from(visits)
        .innerJoin(visitors, eq(visits.visitorId, visitors.id))
        .where(and(eq(visits.status, 'CHECKED_IN'), lt(visits.expectedTo, sql`now() - interval '30 minutes'`)))
        .orderBy(asc(visits.expectedTo));
      if (overdue.length > 0) this.realtime.emitToGate('visits.overdue', { visitors: overdue });
    } catch (err) {
      this.logger.warn(`flagOverdue failed: ${(err as Error).message}`);
    }
  }
}

@Module({ providers: [TasksService] })
export class TasksModule {}
