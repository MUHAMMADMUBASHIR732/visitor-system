import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  Injectable,
  Module,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { desc, eq, and, gte, inArray, lt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { Auth, AuthUser, CurrentUser } from '../common/auth';
import { ScopeService } from '../common/scope.module';
import { DB, Database } from '../db/db.module';
import { auditLogs, departments, users, visitors, visits } from '../db/schema';

export class RangeDto {
  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}

export class AuditQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number;
}

/** Spreadsheet apps run text that starts with these characters as a formula. */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

@Injectable()
export class ReportsService {
  private readonly tz: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    config: ConfigService,
    private readonly scope: ScopeService,
  ) {
    this.tz = config.get<string>('OFFICE_TIMEZONE') ?? 'Asia/Karachi';
  }

  private range(q: RangeDto) {
    const to = q.to ? new Date(q.to) : new Date(Date.now() + 24 * 3600_000);
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 24 * 3600_000);
    if (from >= to) throw new BadRequestException('The start date must be before the end date.');
    if (to.getTime() - from.getTime() > 400 * 24 * 3600_000) {
      throw new BadRequestException('Choose a range of at most 400 days.');
    }
    return { from, to };
  }

  async summary(user: AuthUser, q: RangeDto) {
    const { from, to } = this.range(q);
    const only = await this.scope.hostFilter(user);
    const onlyV = await this.scope.hostFilter(user, 'v.host_id');
    const f = from.toISOString();
    const t = to.toISOString();
    const inRange = sql`expected_from >= ${f}::timestamptz and expected_from < ${t}::timestamptz`;

    const [totals, byDay, byHour, topHosts, byStatus] = await Promise.all([
      this.db.execute(sql`
        select
          count(*)::int as total,
          count(*) filter (where status in ('CHECKED_IN','CHECKED_OUT'))::int as arrived,
          count(*) filter (where is_walk_in)::int as walk_ins,
          count(*) filter (where status = 'NO_SHOW')::int as no_shows,
          count(*) filter (where status = 'CANCELLED')::int as cancelled,
          coalesce(round(avg(extract(epoch from (check_out_at - check_in_at)) / 60)
            filter (where check_out_at is not null))::int, 0) as avg_minutes,
          (select count(*)::int from visits where status = 'CHECKED_IN' ${only}) as inside_now
        from visits where ${inRange} ${only}`),
      this.db.execute(sql`
        select to_char(date_trunc('day', expected_from at time zone ${this.tz}), 'YYYY-MM-DD') as day,
          count(*)::int as visits,
          count(*) filter (where status in ('CHECKED_IN','CHECKED_OUT'))::int as arrived
        from visits where ${inRange} ${only} group by 1 order by 1`),
      this.db.execute(sql`
        select extract(hour from check_in_at at time zone ${this.tz})::int as hour, count(*)::int as arrivals
        from visits where check_in_at >= ${f}::timestamptz and check_in_at < ${t}::timestamptz
        ${only}
        group by 1 order by 1`),
      this.db.execute(sql`
        select u.id, u.name, count(*)::int as visits
        from visits v join users u on u.id = v.host_id
        where ${sql.raw('v.expected_from')} >= ${f}::timestamptz and v.expected_from < ${t}::timestamptz ${onlyV}
        group by u.id, u.name order by visits desc, u.name limit 5`),
      this.db.execute(sql`
        select status, count(*)::int as count from visits where ${inRange} ${only} group by status order by count desc`),
    ]);

    const tot = totals.rows[0] as Record<string, number>;
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: {
        total: tot.total,
        arrived: tot.arrived,
        walkIns: tot.walk_ins,
        noShows: tot.no_shows,
        cancelled: tot.cancelled,
        avgMinutes: tot.avg_minutes,
        insideNow: tot.inside_now,
      },
      byDay: byDay.rows,
      byHour: byHour.rows,
      topHosts: topHosts.rows,
      byStatus: byStatus.rows,
    };
  }

  async csv(user: AuthUser, q: RangeDto): Promise<string> {
    const { from, to } = this.range(q);
    const ids = await this.scope.visibleUserIds(user);
    const rows = await this.db
      .select({
        visit: visits,
        visitor: visitors,
        host: users.name,
        department: departments.name,
      })
      .from(visits)
      .innerJoin(visitors, eq(visits.visitorId, visitors.id))
      .innerJoin(users, eq(visits.hostId, users.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(and(gte(visits.expectedFrom, from), lt(visits.expectedFrom, to), ids ? inArray(visits.hostId, ids) : undefined))
      .orderBy(desc(visits.expectedFrom))
      .limit(50_000);

    const fmt = (d: Date | null) =>
      d ? d.toLocaleString('sv-SE', { timeZone: this.tz }).replace('T', ' ') : '';
    const header = [
      'Expected', 'Visitor', 'Phone', 'Company', 'ID number', 'Host', 'Department', 'Purpose',
      'Status', 'Walk-in', 'Checked in', 'Checked out', 'Minutes inside', 'Badge', 'Vehicle',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const { visit, visitor, host, department } of rows) {
      const minutes =
        visit.checkInAt && visit.checkOutAt
          ? Math.round((visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / 60_000)
          : '';
      lines.push(
        [
          fmt(visit.expectedFrom), visitor.fullName, visitor.phone, visitor.company, visitor.idNumber, host,
          department, visit.purpose, visit.status, visit.isWalkIn ? 'Yes' : 'No', fmt(visit.checkInAt),
          fmt(visit.checkOutAt), minutes, visit.badgeNumber, visit.vehiclePlate,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return '﻿' + lines.join('\r\n');
  }

  async audit(q: AuditQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 30;
    const [items, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entity: auditLogs.entity,
          entityId: auditLogs.entityId,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          user: users.name,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: sql<number>`count(*)::int` }).from(auditLogs),
    ]);
    return { items, total: count, page, pageSize };
  }
}

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports/summary')
  @Auth('ADMIN', 'SENIOR_MANAGER', 'MANAGER')
  summary(@CurrentUser() user: AuthUser, @Query() q: RangeDto) {
    return this.reports.summary(user, q);
  }

  @Get('reports/export.csv')
  @Auth('ADMIN', 'SENIOR_MANAGER', 'MANAGER')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="foyer-visits.csv"')
  async export(@CurrentUser() user: AuthUser, @Query() q: RangeDto) {
    return new StreamableFile(Buffer.from(await this.reports.csv(user, q), 'utf8'));
  }

  @Get('audit')
  @Auth('ADMIN')
  audit(@Query() q: AuditQueryDto) {
    return this.reports.audit(q);
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
