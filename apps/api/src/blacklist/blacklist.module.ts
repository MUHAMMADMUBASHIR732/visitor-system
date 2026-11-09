import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { desc, eq, or, SQL } from 'drizzle-orm';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../audit/audit.module';
import { Auth, AuthUser, CurrentUser } from '../common/auth';
import { normalizeIdNumber, normalizePhone } from '../common/normalize';
import { DB, Database } from '../db/db.module';
import { blacklist } from '../db/schema';

export class CreateBlacklistDto {
  @IsOptional() @IsString() @MaxLength(100)
  fullName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(40)
  idNumber?: string;

  @IsString() @MinLength(3) @MaxLength(300)
  reason!: string;
}

@Injectable()
export class BlacklistService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /** Returns the matching entry if this phone number or ID number is blocked. */
  async findMatch(input: { phone?: string | null; idNumber?: string | null }) {
    const conds: SQL[] = [];
    if (input.phone) conds.push(eq(blacklist.phone, normalizePhone(input.phone)));
    if (input.idNumber) conds.push(eq(blacklist.idNumber, normalizeIdNumber(input.idNumber)));
    if (conds.length === 0) return null;
    const [entry] = await this.db.select().from(blacklist).where(or(...conds)).limit(1);
    return entry ?? null;
  }

  list() {
    return this.db.select().from(blacklist).orderBy(desc(blacklist.createdAt));
  }

  async create(actor: AuthUser, dto: CreateBlacklistDto) {
    const phone = dto.phone?.trim() ? normalizePhone(dto.phone) : null;
    const idNumber = dto.idNumber?.trim() ? normalizeIdNumber(dto.idNumber) : null;
    if (!phone && !idNumber) {
      throw new BadRequestException('Add a phone number or an ID number so the visitor can be recognised.');
    }
    const [created] = await this.db
      .insert(blacklist)
      .values({
        fullName: dto.fullName?.trim() || null,
        phone,
        idNumber,
        reason: dto.reason.trim(),
        addedById: actor.id,
      })
      .returning();
    await this.audit.log(actor.id, 'blacklist.add', 'blacklist', created.id);
    return created;
  }

  async remove(actor: AuthUser, id: string) {
    const removed = await this.db.delete(blacklist).where(eq(blacklist.id, id)).returning({ id: blacklist.id });
    if (removed.length === 0) throw new NotFoundException('Blacklist entry not found.');
    await this.audit.log(actor.id, 'blacklist.remove', 'blacklist', id);
  }
}

@Controller('blacklist')
@Auth('ADMIN')
export class BlacklistController {
  constructor(private readonly service: BlacklistService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateBlacklistDto) {
    return this.service.create(actor, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(actor, id);
  }
}

@Module({
  controllers: [BlacklistController],
  providers: [BlacklistService],
  exports: [BlacklistService],
})
export class BlacklistModule {}
