import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import { DB, Database } from '../db/db.module';
import { auditLogs } from '../db/schema';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(@Inject(DB) private readonly db: Database) {}

  /** Never throws: an audit failure must not block the action being audited. */
  async log(
    userId: string | null,
    action: string,
    entity: string,
    entityId?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.db.insert(auditLogs).values({
        userId,
        action,
        entity,
        entityId: entityId ?? null,
        metadata: metadata ?? null,
      });
    } catch (err) {
      this.logger.warn(`Could not write audit log (${action}): ${(err as Error).message}`);
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
