import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '../../../auth/constants/permissions';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { ApiAuth } from '../../../common/decorators/api-auth.decorator';
import { ApiOkEnvelope } from '../../../common/decorators/api-response.decorator';
import { ApiMutationHeaders, IfMatchVersion } from '../../../common/decorators/concurrency.decorator';
import { ApprovalDecisionDto, ListApprovalsQueryDto } from '../dto/approvals.dto';
import { ApprovalsService } from '../services/approvals.service';

@ApiTags('approvals')
@ApiAuth()
@Controller('v1/approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @RequirePermissions(Permission.REVIEWS_READ)
  @ApiOperation({ summary: 'Approval queue for one type (pending by default)' })
  @ApiOkEnvelope('Paginated approvals')
  list(@Query() query: ListApprovalsQueryDto) {
    return this.approvals.list(query);
  }

  @Get('summary')
  @RequirePermissions(Permission.REVIEWS_READ)
  @ApiOperation({ summary: 'Pending counts per approval type' })
  @ApiOkEnvelope('Summary')
  summary() {
    return this.approvals.summary();
  }

  @Get(':id')
  @RequirePermissions(Permission.REVIEWS_READ)
  @ApiOperation({ summary: 'Approval detail (shape depends on type) with the caller’s decision state' })
  @ApiOkEnvelope('Approval detail')
  get(@Param('id', new ParseIntPipe({ errorHttpStatusCode: 422 })) id: number, @CurrentUser() user: AuthUser) {
    return this.approvals.get(id, user);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RequirePermissions(Permission.REVIEWS_APPROVE)
  @ApiOperation({ summary: 'Approve or decline (maker-checker enforced; decline needs a reason)' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Decision recorded')
  decide(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: 422 })) id: number,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser() user: AuthUser,
    @IfMatchVersion() ifMatch?: number,
  ) {
    return this.approvals.decide(id, dto, user, ifMatch);
  }
}
