import {
  Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Permission } from '../../../auth/constants/permissions';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { ApiAuth } from '../../../common/decorators/api-auth.decorator';
import { ApiOkEnvelope } from '../../../common/decorators/api-response.decorator';
import { ApiMutationHeaders, IfMatchVersion } from '../../../common/decorators/concurrency.decorator';
import {
  CancelClaimDto, PaymentSplitDto, PickupDto, RepairCompletionDto, RequestDiagnosisApprovalDto,
  TimelineQueryDto, UploadQuoteDto,
} from '../dto/claim-actions.dto';
import { CreateClaimDto } from '../dto/create-claim.dto';
import { ListClaimsQueryDto } from '../dto/list-claims-query.dto';
import { ClaimsService } from '../services/claims.service';

const Id = () => Param('id', new ParseIntPipe({ errorHttpStatusCode: 422 }));

@ApiTags('claims')
@ApiAuth()
@Controller('v1/claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  @RequirePermissions(Permission.CLAIMS_READ)
  @ApiOperation({ summary: 'List claims', description: 'Filter by country, status[], claimType, vendorId, qaState, date range, or search by `searchType` + `search`.' })
  @ApiOkEnvelope('Paginated claims')
  list(@Query() query: ListClaimsQueryDto) {
    return this.claims.list(query);
  }

  @Get('summary')
  @RequirePermissions(Permission.CLAIMS_READ)
  @ApiOperation({ summary: 'Dashboard counters (active claims only)' })
  @ApiOkEnvelope('Counters')
  summary() {
    return this.claims.summary();
  }

  @Get(':id')
  @RequirePermissions(Permission.CLAIMS_READ)
  @ApiOperation({ summary: 'Claim detail with workflow rail, QA, documents and available actions' })
  @ApiOkEnvelope('Claim detail')
  get(@Id() id: number, @CurrentUser() user: AuthUser) {
    return this.claims.get(id, user);
  }

  @Get(':id/timeline')
  @RequirePermissions(Permission.CLAIMS_READ)
  @ApiOperation({ summary: 'Activity timeline' })
  @ApiOkEnvelope('Paginated timeline')
  timeline(@Id() id: number, @Query() query: TimelineQueryDto) {
    return this.claims.timeline(id, query);
  }

  @Get(':id/status-history')
  @RequirePermissions(Permission.CLAIMS_READ)
  @ApiOperation({ summary: 'Every status change with actor and reason' })
  @ApiOkEnvelope('Status history')
  statusHistory(@Id() id: number) {
    return this.claims.statusHistory(id);
  }

  @Get(':id/documents')
  @RequirePermissions(Permission.CLAIMS_READ)
  @ApiOperation({ summary: 'Documents attached to the claim' })
  @ApiOkEnvelope('Documents')
  documents(@Id() id: number) {
    return this.claims.documents(id);
  }

  @Get(':id/available-actions')
  @RequirePermissions(Permission.CLAIMS_READ)
  @ApiOperation({ summary: 'Workflow actions with enabled flag and disabled reason for the current user' })
  @ApiOkEnvelope('Actions')
  availableActions(@Id() id: number, @CurrentUser() user: AuthUser) {
    return this.claims.availableActions(id, user);
  }

  @Get(':id/cover-breakdown')
  @RequirePermissions(Permission.CLAIMS_READ)
  @ApiOperation({ summary: 'Plan cover limits per component, with amounts already used on this car' })
  @ApiOkEnvelope('Cover breakdown')
  coverBreakdown(@Id() id: number) {
    return this.claims.coverBreakdown(id);
  }

  @Post()
  @RequirePermissions(Permission.CLAIMS_WRITE)
  @ApiOperation({ summary: 'Create a claim / job order and issue the scheduling link' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Claim created')
  create(@Body() dto: CreateClaimDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const created = this.claims.create(dto, user);
    res.setHeader('Location', `/v1/claims/${created.id}`);
    return created;
  }

  @Post(':id/schedule-link/resends')
  @HttpCode(200)
  @RequirePermissions(Permission.CLAIMS_WRITE)
  @ApiOperation({ summary: 'Resend the scheduling link (3 per 24h)' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Link resent')
  resend(@Id() id: number, @CurrentUser() user: AuthUser, @IfMatchVersion() ifMatch?: number) {
    return this.claims.resendScheduleLink(id, user, ifMatch);
  }

  @Post(':id/diagnosis-approval-requests')
  @HttpCode(200)
  @RequirePermissions(Permission.CLAIMS_WRITE)
  @ApiOperation({ summary: 'Request approval to carry out diagnosis' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Approval requested')
  requestDiagnosis(@Id() id: number, @Body() dto: RequestDiagnosisApprovalDto, @CurrentUser() user: AuthUser, @IfMatchVersion() ifMatch?: number) {
    return this.claims.requestDiagnosisApproval(id, dto, user, ifMatch);
  }

  @Post(':id/quotes')
  @RequirePermissions(Permission.CLAIMS_WRITE)
  @ApiOperation({ summary: 'Upload the repair quote with its line items' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Quote submitted')
  uploadQuote(@Id() id: number, @Body() dto: UploadQuoteDto, @CurrentUser() user: AuthUser, @IfMatchVersion() ifMatch?: number) {
    return this.claims.uploadQuote(id, dto, user, ifMatch);
  }

  @Put(':id/payment-split')
  @RequirePermissions(Permission.CLAIMS_WRITE)
  @ApiOperation({ summary: 'Submit the payment split (must equal the quote total)' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Split recorded')
  paymentSplit(@Id() id: number, @Body() dto: PaymentSplitDto, @CurrentUser() user: AuthUser, @IfMatchVersion() ifMatch?: number) {
    return this.claims.submitPaymentSplit(id, dto, user, ifMatch);
  }

  @Post(':id/repair-completion')
  @HttpCode(200)
  @RequirePermissions(Permission.CLAIMS_WRITE)
  @ApiOperation({ summary: 'Mark the repair complete and open QC' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Repair completed')
  repairCompletion(@Id() id: number, @Body() dto: RepairCompletionDto, @CurrentUser() user: AuthUser, @IfMatchVersion() ifMatch?: number) {
    return this.claims.completeRepair(id, dto, user, ifMatch);
  }

  @Post(':id/pickup')
  @HttpCode(200)
  @RequirePermissions(Permission.CLAIMS_WRITE)
  @ApiOperation({ summary: 'Complete vehicle pickup and close the claim' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Pickup completed')
  pickup(@Id() id: number, @Body() dto: PickupDto, @CurrentUser() user: AuthUser, @IfMatchVersion() ifMatch?: number) {
    return this.claims.completePickup(id, dto, user, ifMatch);
  }

  @Post(':id/cancellation')
  @HttpCode(200)
  @RequirePermissions(Permission.CLAIMS_WRITE)
  @ApiOperation({ summary: 'Cancel a claim (pending approvals are closed)' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Claim cancelled')
  cancel(@Id() id: number, @Body() dto: CancelClaimDto, @CurrentUser() user: AuthUser, @IfMatchVersion() ifMatch?: number) {
    return this.claims.cancel(id, dto, user, ifMatch);
  }
}
