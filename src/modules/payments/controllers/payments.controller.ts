import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '../../../auth/constants/permissions';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { ApiAuth } from '../../../common/decorators/api-auth.decorator';
import { ApiOkEnvelope } from '../../../common/decorators/api-response.decorator';
import { ApiMutationHeaders, IfMatchVersion } from '../../../common/decorators/concurrency.decorator';
import { ListPaymentApprovalsQueryDto, ListPaymentsQueryDto, PaymentActionDto, RequestPaymentDto } from '../dto/payments.dto';
import { PaymentsService } from '../services/payments.service';

const Id = () => Param('id', new ParseIntPipe({ errorHttpStatusCode: 422 }));

@ApiTags('payments')
@ApiAuth()
@Controller('v1/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('summary')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Counts of payments awaiting action' })
  @ApiOkEnvelope('Summary')
  summary() {
    return this.payments.summary();
  }

  @Get('quotes')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Upfront (quote) payments' })
  @ApiOkEnvelope('Paginated payments')
  quotes(@Query() query: ListPaymentsQueryDto) {
    return this.payments.list('quotes', query);
  }

  @Get('quotes/:id')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Upfront payment detail with payee account' })
  @ApiOkEnvelope('Payment')
  quote(@Id() id: number) {
    return this.payments.get('quotes', id);
  }

  @Get('repairs')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Balance (repair) payments' })
  @ApiOkEnvelope('Paginated payments')
  repairs(@Query() query: ListPaymentsQueryDto) {
    return this.payments.list('repairs', query);
  }

  @Get('repairs/:id')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Balance payment detail with payee account' })
  @ApiOkEnvelope('Payment')
  repair(@Id() id: number) {
    return this.payments.get('repairs', id);
  }

  @Get('approvals')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Payment approval queue (pending by default)' })
  @ApiOkEnvelope('Paginated payment approvals')
  approvals(@Query() query: ListPaymentApprovalsQueryDto) {
    return this.payments.listApprovals(query);
  }

  @Get('approvals/:id')
  @RequirePermissions(Permission.PAYMENTS_READ)
  @ApiOperation({ summary: 'Payment approval detail: breakdown, bank, and whether you can decide' })
  @ApiOkEnvelope('Payment approval')
  approval(@Id() id: number, @CurrentUser() user: AuthUser) {
    return this.payments.getApproval(id, user);
  }

  @Post('request')
  @RequirePermissions(Permission.PAYMENTS_WRITE)
  @ApiOperation({ summary: 'Request payment for a quote or completed repair (opens a payment approval)' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Payment requested')
  request(@Body() dto: RequestPaymentDto, @CurrentUser() user: AuthUser) {
    return this.payments.request(dto, user);
  }

  @Post('action')
  @HttpCode(200)
  @RequirePermissions(Permission.PAYMENTS_APPROVE)
  @ApiOperation({ summary: 'Approve/decline a payment approval, or approve/decline/dispute a payment row' })
  @ApiMutationHeaders()
  @ApiOkEnvelope('Action applied')
  action(@Body() dto: PaymentActionDto, @CurrentUser() user: AuthUser, @IfMatchVersion() ifMatch?: number) {
    return this.payments.action(dto, user, ifMatch);
  }
}
