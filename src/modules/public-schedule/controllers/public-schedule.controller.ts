import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/public.decorator';
import { ApiOkEnvelope } from '../../../common/decorators/api-response.decorator';
import { ScheduleStateQueryDto, ScheduleSubmissionDto, ScheduleVendorsQueryDto, SlotsQueryDto } from '../dto/schedule-submission.dto';
import { PublicScheduleService } from '../services/public-schedule.service';

/** Customer-facing endpoints: no login, authorised only by the unguessable link token. */
@ApiTags('public-schedule')
@Public()
@Controller('v1/public/schedule')
export class PublicScheduleController {
  constructor(private readonly schedule: PublicScheduleService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Resolve a scheduling link: vehicle, categories, workshops, rules and the form schema' })
  @ApiOkEnvelope('Schedule form context')
  resolve(@Param('token') token: string) {
    return this.schedule.resolve(token);
  }

  @Get(':token/vendors')
  @ApiOperation({ summary: 'Workshops available for this request (options_source of the form)' })
  @ApiOkEnvelope('Workshops')
  vendors(@Param('token') token: string, @Query() query: ScheduleVendorsQueryDto) {
    return this.schedule.vendors(token, query.city);
  }

  @Get(':token/states')
  @ApiOperation({ summary: 'States for the claim country' })
  @ApiOkEnvelope('States')
  states(@Param('token') token: string) {
    return this.schedule.states(token);
  }

  @Get(':token/cities')
  @ApiOperation({ summary: 'Cities for the claim country' })
  @ApiOkEnvelope('Cities')
  cities(@Param('token') token: string, @Query() query: ScheduleStateQueryDto) {
    return this.schedule.cities(token, query.state);
  }

  @Get(':token/slots')
  @ApiOperation({ summary: 'Bookable appointment slots for a workshop' })
  @ApiOkEnvelope('Slots by date')
  slots(@Param('token') token: string, @Query() query: SlotsQueryDto) {
    return this.schedule.slots(token, query);
  }

  @Post(':token/submission')
  @ApiOperation({ summary: 'Submit the scheduling form (single use)' })
  @ApiOkEnvelope('Appointment confirmed')
  submit(@Param('token') token: string, @Body() dto: ScheduleSubmissionDto) {
    return this.schedule.submit(token, dto);
  }
}
