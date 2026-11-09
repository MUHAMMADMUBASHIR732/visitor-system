import {
  Body,
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule, PassportStrategy } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../common/password';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuditService } from '../audit/audit.module';
import { Auth, AuthUser, CurrentUser } from '../common/auth';
import { DB, Database } from '../db/db.module';
import { departments, users } from '../db/schema';

export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(200)
  currentPassword!: string;

  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(DB) private readonly db: Database,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const [user] = await this.db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || !user.isActive) throw new UnauthorizedException('Your session has ended. Sign in again.');
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}

@Injectable()
export class AuthService {
  // Used to keep response time similar whether or not the email exists.
  private readonly dummyHash = bcrypt.hashSync('not-a-real-password', 10);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const [row] = await this.db
      .select({ user: users, department: departments.name })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()))
      .limit(1);

    if (row?.user.lockedUntil && row.user.lockedUntil > new Date()) {
      const mins = Math.ceil((row.user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException(`Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const ok = await bcrypt.compare(password, row?.user.passwordHash ?? this.dummyHash);
    if (!row || !ok || !row.user.isActive) {
      if (row && !ok) {
        const failed = row.user.failedLogins + 1;
        const lock = failed >= MAX_FAILURES;
        await this.db
          .update(users)
          .set({ failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
          .where(eq(users.id, row.user.id));
        if (lock) await this.audit.log(row.user.id, 'auth.locked', 'user', row.user.id);
      }
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    if (row.user.failedLogins > 0 || row.user.lockedUntil) {
      await this.db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, row.user.id));
    }
    const accessToken = await this.jwt.signAsync({ sub: row.user.id, role: row.user.role });
    await this.audit.log(row.user.id, 'auth.login', 'user', row.user.id);
    return { accessToken, user: this.publicUser(row.user, row.department) };
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Your current password is not correct.');
    }
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException('Choose a password you have not used just now.');
    await this.db.update(users).set({ passwordHash: await bcrypt.hash(dto.newPassword, 10) }).where(eq(users.id, id));
    await this.audit.log(id, 'auth.password_change', 'user', id);
    return { ok: true };
  }

  async me(id: string) {
    const [row] = await this.db
      .select({ user: users, department: departments.name })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.id, id))
      .limit(1);
    if (!row) throw new UnauthorizedException();
    return this.publicUser(row.user, row.department);
  }

  private publicUser(u: typeof users.$inferSelect, department: string | null) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      department,
      managerId: u.managerId,
    };
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password')
  @Auth()
  @HttpCode(200)
  password(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }

  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: Number(config.get('JWT_EXPIRES_SECONDS') ?? 43200) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
