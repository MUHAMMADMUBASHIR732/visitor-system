import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Auth, AuthUser, CurrentUser } from '../common/auth';
import { HOST_ROLES } from '../db/schema';
import { BlacklistModule } from '../blacklist/blacklist.module';
import { CreateVisitDto, ListVisitsDto } from './visits.dto';
import { VisitsService } from './visits.service';
import { PassService } from '../pass/pass.module';

@Controller('visits')
@Auth()
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Post()
  @Auth(...HOST_ROLES)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVisitDto) {
    return this.visits.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListVisitsDto) {
    return this.visits.list(user, query);
  }

  // Declared before ":id" so "summary" is not parsed as an id.
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.visits.summary(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.visits.findOne(user, id);
  }

  @Patch(':id/cancel')
  @Auth(...HOST_ROLES)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.visits.cancel(user, id);
  }

  @Patch(':id/approve')
  @Auth(...HOST_ROLES)
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.visits.decide(user, id, 'APPROVED');
  }

  @Patch(':id/reject')
  @Auth(...HOST_ROLES)
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.visits.decide(user, id, 'REJECTED');
  }

  @Post(':id/resend')
  @Auth(...HOST_ROLES)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resend(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.visits.resendInvite(user, id);
  }
}

@Controller('visitors')
@Auth()
export class VisitorsController {
  constructor(private readonly visits: VisitsService) {}

  @Get('lookup')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  lookup(@Query('phone') phone = '') {
    return this.visits.lookupVisitor(phone);
  }
}

/** Public: lets a visitor open their own pass from the emailed link. No sign-in. */
@Injectable()
export class PublicPassService {
  constructor(
    private readonly visits: VisitsService,
    private readonly pass: PassService,
  ) {}

  async get(token: string) {
    const parsed = this.pass.verify(token);
    if (!parsed) throw new NotFoundException('This pass link is not valid.');
    const row = await this.visits.getRow(parsed.visitId).catch(() => null);
    if (!row) throw new NotFoundException('This pass link is not valid.');
    const v = this.visits.serialize(row);
    // Share only what the visitor needs, never IDs or internal data.
    return {
      status: v.status,
      visitorName: v.visitor.fullName,
      company: v.visitor.company,
      hostName: v.host.name,
      purpose: v.purpose,
      expectedFrom: v.expectedFrom,
      expectedTo: v.expectedTo,
      passCode: v.passCode,
      passToken: v.passToken,
    };
  }
}

@Controller('public')
export class PublicController {
  constructor(private readonly service: PublicPassService) {}

  @Get('pass/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  pass(@Param('token') token: string) {
    return this.service.get(token);
  }
}

@Module({
  imports: [BlacklistModule],
  controllers: [VisitsController, VisitorsController, PublicController],
  providers: [VisitsService, PublicPassService],
  exports: [VisitsService],
})
export class VisitsModule {}
