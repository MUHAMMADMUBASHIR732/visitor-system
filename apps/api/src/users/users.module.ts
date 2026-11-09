import {
  Body,
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Query,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuditService } from '../audit/audit.module';
import { Auth, AuthUser, CurrentUser } from '../common/auth';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../common/password';
import { ScopeService } from '../common/scope.module';
import { DB, Database } from '../db/db.module';
import { departments, HOST_ROLES, ROLES, Role, users } from '../db/schema';

export class CreateUserDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;

  @IsIn(ROLES as unknown as string[])
  role!: Role;

  @IsOptional() @IsUUID()
  departmentId?: string;

  /** Who this person reports to. Set automatically when a manager adds someone. */
  @IsOptional() @IsUUID()
  managerId?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password?: string;

  @IsOptional() @IsIn(ROLES as unknown as string[])
  role?: Role;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsUUID()
  departmentId?: string;
}

export class CreateDepartmentDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;
}

const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  role: users.role,
  isActive: users.isActive,
  departmentId: users.departmentId,
  department: departments.name,
  managerId: users.managerId,
  lockedUntil: users.lockedUntil,
  createdAt: users.createdAt,
};

/** Who may be added by whom, and who each role reports to. */
const CAN_CREATE: Record<Role, Role[]> = {
  ADMIN: ['SENIOR_MANAGER', 'MANAGER', 'HOST', 'EMPLOYEE', 'GUARD', 'ADMIN'],
  SENIOR_MANAGER: ['MANAGER'],
  MANAGER: ['HOST', 'EMPLOYEE'],
  HOST: [],
  EMPLOYEE: [],
  GUARD: [],
};
const PARENT_ROLE: Partial<Record<Role, Role>> = { MANAGER: 'SENIOR_MANAGER', HOST: 'MANAGER', EMPLOYEE: 'MANAGER' };

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly scope: ScopeService,
  ) {}

  /** The people the actor manages (admins see everyone). */
  async list(actor: AuthUser) {
    const ids = await this.scope.visibleUserIds(actor);
    return this.db
      .select(userColumns)
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(ids ? inArray(users.id, ids) : undefined)
      .orderBy(asc(users.name));
  }

  /** People a visitor can be registered to see. "team" limits it to the actor's own team. */
  async hosts(actor: AuthUser, onlyTeam: boolean) {
    const ids = onlyTeam ? await this.scope.visibleUserIds(actor) : null;
    return this.db
      .select({ id: users.id, name: users.name, role: users.role, department: departments.name })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(and(eq(users.isActive, true), inArray(users.role, HOST_ROLES), ids ? inArray(users.id, ids) : undefined))
      .orderBy(asc(users.name));
  }

  /** Managers (or senior managers) an admin can attach someone to. */
  async parents(actor: AuthUser, role: Role) {
    const parentRole = PARENT_ROLE[role];
    if (!parentRole || actor.role !== 'ADMIN') return [];
    return this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, parentRole), eq(users.isActive, true)))
      .orderBy(asc(users.name));
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    if (!CAN_CREATE[actor.role].includes(dto.role)) {
      throw new ForbiddenException(
        actor.role === 'SENIOR_MANAGER'
          ? 'Senior managers can only add managers.'
          : actor.role === 'MANAGER'
            ? 'Managers can only add hosts and employees.'
            : 'You cannot add this kind of person.',
      );
    }
    const email = dto.email.trim().toLowerCase();
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, email))
      .limit(1);
    if (existing) throw new ConflictException('A user with this email already exists.');

    // Managers and senior managers always add people under themselves; admins choose.
    let managerId: string | null = actor.role === 'ADMIN' ? (dto.managerId ?? null) : actor.id;
    const parentRole = PARENT_ROLE[dto.role];
    if (managerId && parentRole) {
      const [parent] = await this.db.select({ role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, managerId)).limit(1);
      if (!parent || !parent.isActive || parent.role !== parentRole) {
        throw new BadRequestException(`A ${dto.role.toLowerCase().replace('_', ' ')} must report to a ${parentRole.toLowerCase().replace('_', ' ')}.`);
      }
    }
    if (!parentRole) managerId = null;

    const [created] = await this.db
      .insert(users)
      .values({
        name: dto.name.trim(),
        email,
        phone: dto.phone?.trim() || null,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: dto.role,
        departmentId: dto.departmentId ?? null,
        managerId,
      })
      .returning({ id: users.id });
    await this.audit.log(actor.id, 'user.create', 'user', created.id, { role: dto.role, managerId });
    return this.one(created.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    if (id === actor.id && (dto.isActive === false || (dto.role && dto.role !== actor.role))) {
      throw new ConflictException('You cannot deactivate yourself or change your own role.');
    }
    if (actor.role !== 'ADMIN') {
      if (id === actor.id) throw new ForbiddenException('Use "Change password" to update your own account.');
      if (!(await this.scope.canSee(actor, id))) throw new ForbiddenException('This person is not on your team.');
      if (dto.role !== undefined) throw new ForbiddenException('Only an administrator can change roles.');
    }
    const patch: Partial<typeof users.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.phone !== undefined) patch.phone = dto.phone.trim() || null;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.departmentId !== undefined) patch.departmentId = dto.departmentId;
    if (dto.password !== undefined) {
      patch.passwordHash = await bcrypt.hash(dto.password, 10);
      patch.failedLogins = 0;
      patch.lockedUntil = null;
    }
    if (dto.isActive === true) {
      patch.failedLogins = 0;
      patch.lockedUntil = null;
    }

    if (Object.keys(patch).length > 0) {
      const updated = await this.db.update(users).set(patch).where(eq(users.id, id)).returning({ id: users.id });
      if (updated.length === 0) throw new NotFoundException('User not found.');
    }
    await this.audit.log(actor.id, 'user.update', 'user', id, { fields: Object.keys(dto) });
    return this.one(id);
  }

  private async one(id: string) {
    const [row] = await this.db
      .select(userColumns)
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('User not found.');
    return row;
  }

  listDepartments() {
    return this.db.select().from(departments).orderBy(asc(departments.name));
  }

  async createDepartment(actor: AuthUser, name: string) {
    const clean = name.trim();
    const [existing] = await this.db
      .select()
      .from(departments)
      .where(eq(sql`lower(${departments.name})`, clean.toLowerCase()))
      .limit(1);
    if (existing) throw new ConflictException('This department already exists.');
    const [created] = await this.db.insert(departments).values({ name: clean }).returning();
    await this.audit.log(actor.id, 'department.create', 'department', created.id);
    return created;
  }
}

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users/hosts')
  @Auth()
  hosts(@CurrentUser() actor: AuthUser, @Query('scope') scope?: string) {
    return this.users.hosts(actor, scope === 'team');
  }

  @Get('users/parents')
  @Auth('ADMIN')
  parents(@CurrentUser() actor: AuthUser, @Query('role') role: Role) {
    return this.users.parents(actor, role);
  }

  @Get('users')
  @Auth('ADMIN', 'SENIOR_MANAGER', 'MANAGER')
  list(@CurrentUser() actor: AuthUser) {
    return this.users.list(actor);
  }

  @Post('users')
  @Auth('ADMIN', 'SENIOR_MANAGER', 'MANAGER')
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto);
  }

  @Patch('users/:id')
  @Auth('ADMIN', 'SENIOR_MANAGER', 'MANAGER')
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(actor, id, dto);
  }

  @Get('departments')
  @Auth()
  departments() {
    return this.users.listDepartments();
  }

  @Post('departments')
  @Auth('ADMIN')
  createDepartment(@CurrentUser() actor: AuthUser, @Body() dto: CreateDepartmentDto) {
    return this.users.createDepartment(actor, dto.name);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
