import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import { DB, Database } from './db/db.module';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async check() {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Database is not reachable.');
    }
  }
}
