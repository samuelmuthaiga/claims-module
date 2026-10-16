import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from '../services/payments.service';
import { PaymentSummaryResponseDto, PaymentQuoteResponseDto, PaymentRequestDto, PaymentActionDto } from '../dto/payment.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ResponseDto } from '../../../common/dto/response.dto';

@ApiTags('payments')
@Controller('v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get payments summary' })
  @ApiResponse({ status: 200, description: 'Returns payment summary counts' })
  async getSummary(): Promise<ResponseDto<PaymentSummaryResponseDto>> {
    return {
      data: await this.paymentsService.getSummary(),
    };
  }

  @Get('quotes')
  @ApiOperation({ summary: 'List payment quotes' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of payment quotes' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getQuotes(@Query() pagination: PaginationDto): Promise<ResponseDto<PaymentQuoteResponseDto[]>> {
    const { page = 1, limit = 10 } = pagination;
    return await this.paymentsService.getQuotes(page, limit);
  }

  @Post('request')
  @ApiOperation({ summary: 'Request payment' })
  @ApiResponse({ status: 201, description: 'Payment request created successfully' })
  async requestPayment(@Body() requestDto: PaymentRequestDto): Promise<ResponseDto<PaymentQuoteResponseDto>> {
    return {
      data: await this.paymentsService.requestPayment(requestDto),
    };
  }

  @Post('action')
  @ApiOperation({ summary: 'Action payment' })
  @ApiResponse({ status: 200, description: 'Payment action completed successfully' })
  async actionPayment(
    @Body() body: { id: number } & PaymentActionDto,
  ): Promise<ResponseDto<PaymentQuoteResponseDto>> {
    const { id, ...actionDto } = body;
    return {
      data: await this.paymentsService.actionPayment(id, actionDto),
    };
  }
}
