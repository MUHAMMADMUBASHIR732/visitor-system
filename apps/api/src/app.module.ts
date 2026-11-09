import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BlacklistModule } from './blacklist/blacklist.module';
import { DbModule } from './db/db.module';
import { GateModule } from './gate/gate.module';
import { SERVERLESS } from './common/runtime';
import { ScopeModule } from './common/scope.module';
import { InboxModule } from './inbox/inbox.module';
import { HealthController } from './health.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { PassModule } from './pass/pass.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReportsModule } from './reports/reports.module';
import { RollCallModule } from './rollcall/rollcall.module';
import { StorageModule } from './storage/storage.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { VisitsModule } from './visits/visits.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 240 }]),
    ...(SERVERLESS ? [] : [ScheduleModule.forRoot()]),
    DbModule,
    AuditModule,
    PassModule,
    StorageModule,
    ScopeModule,
    NotificationsModule,
    AuthModule,
    RealtimeModule,
    InboxModule,
    UsersModule,
    BlacklistModule,
    VisitsModule,
    GateModule,
    RollCallModule,
    ReportsModule,
    TasksModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
