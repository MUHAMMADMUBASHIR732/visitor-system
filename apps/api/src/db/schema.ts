import {
  AnyPgColumn,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['ADMIN', 'HOST', 'GUARD', 'SENIOR_MANAGER', 'MANAGER', 'EMPLOYEE']);
export const visitStatusEnum = pgEnum('visit_status', [
  'SCHEDULED',
  'PENDING_APPROVAL',
  'APPROVED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'REJECTED',
  'NO_SHOW',
]);

export type Role = (typeof roleEnum.enumValues)[number];
export type VisitStatus = (typeof visitStatusEnum.enumValues)[number];
export const ROLES = roleEnum.enumValues;

/** Roles that can be visited, invite visitors and approve walk-ins. */
export const HOST_ROLES: Role[] = ['ADMIN', 'SENIOR_MANAGER', 'MANAGER', 'HOST', 'EMPLOYEE'];
/** Roles that run a team and see everything their team does. */
export const MANAGER_ROLES: Role[] = ['SENIOR_MANAGER', 'MANAGER'];
export const VISIT_STATUSES = visitStatusEnum.enumValues;

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const badgeSeq = pgSequence('badge_seq', { startWith: 1, increment: 1 });

/** Visitor photos kept in the database (used on serverless hosting where there is no disk). */
export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  mime: text('mime').notNull(),
  data: bytea('data').notNull(),
  createdAt: createdAt(),
});

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  departmentId: uuid('department_id').references(() => departments.id),
  /** Who this person reports to: employee/host -> manager -> senior manager. */
  managerId: uuid('manager_id').references((): AnyPgColumn => users.id),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: createdAt(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    visitId: uuid('visit_id').references(() => visits.id),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

export const visitors = pgTable(
  'visitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull().unique(),
    email: text('email'),
    company: text('company'),
    idType: text('id_type'),
    idNumber: text('id_number'),
    createdAt: createdAt(),
  },
  (t) => [index('visitors_name_idx').on(t.fullName)],
);

export const visits = pgTable(
  'visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    visitorId: uuid('visitor_id')
      .notNull()
      .references(() => visitors.id),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id),
    purpose: text('purpose').notNull(),
    status: visitStatusEnum('status').notNull().default('SCHEDULED'),
    isWalkIn: boolean('is_walk_in').notNull().default(false),
    expectedFrom: timestamp('expected_from', { withTimezone: true }).notNull(),
    expectedTo: timestamp('expected_to', { withTimezone: true }).notNull(),
    passCode: text('pass_code'),
    checkInAt: timestamp('check_in_at', { withTimezone: true }),
    checkOutAt: timestamp('check_out_at', { withTimezone: true }),
    checkedInById: uuid('checked_in_by').references(() => users.id),
    checkedOutById: uuid('checked_out_by').references(() => users.id),
    entryPhotoUrl: text('entry_photo_url'),
    badgeNumber: text('badge_number'),
    vehiclePlate: text('vehicle_plate'),
    createdAt: createdAt(),
  },
  (t) => [
    index('visits_status_idx').on(t.status),
    index('visits_host_expected_idx').on(t.hostId, t.expectedFrom),
    index('visits_check_in_idx').on(t.checkInAt),
    index('visits_pass_code_idx').on(t.passCode),
  ],
);

export const blacklist = pgTable(
  'blacklist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name'),
    phone: text('phone'),
    idNumber: text('id_number'),
    reason: text('reason').notNull(),
    addedById: uuid('added_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('blacklist_phone_idx').on(t.phone), index('blacklist_id_number_idx').on(t.idNumber)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    metadata: jsonb('metadata'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt)],
);

/** An emergency roll call: a snapshot of everyone inside when it started. */
export const rollCalls = pgTable('roll_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  reason: text('reason'),
  startedById: uuid('started_by').references(() => users.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  endedById: uuid('ended_by').references(() => users.id),
});

export const rollCallEntries = pgTable(
  'roll_call_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rollCallId: uuid('roll_call_id')
      .notNull()
      .references(() => rollCalls.id, { onDelete: 'cascade' }),
    visitId: uuid('visit_id')
      .notNull()
      .references(() => visits.id),
    safeAt: timestamp('safe_at', { withTimezone: true }),
    markedById: uuid('marked_by').references(() => users.id),
  },
  (t) => [index('roll_call_entries_call_idx').on(t.rollCallId)],
);

export type User = typeof users.$inferSelect;
export type Visitor = typeof visitors.$inferSelect;
export type Visit = typeof visits.$inferSelect;
