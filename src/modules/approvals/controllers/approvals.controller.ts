import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ApprovalsService } from '../services/approvals.service';
import { ApprovalResponseDto, ApprovalSummaryResponseDto, ApprovalDecisionDto } from '../dto/approval.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ResponseDto } from '../../../common/dto/response.dto';

@ApiTags('approvals')
@Controller('v1/approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  @ApiOperation({ summary: 'List approvals' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of approvals' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Query() pagination: PaginationDto): Promise<ResponseDto<ApprovalResponseDto[]>> {
    const { page = 1, limit = 10 } = pagination;
    return await this.approvalsService.findAll(page, limit);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get approvals summary' })
  @ApiResponse({ status: 200, description: 'Returns approval summary counts' })
  async getSummary(): Promise<ResponseDto<ApprovalSummaryResponseDto>> {
    return {
      data: await this.approvalsService.getSummary(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get approval detail' })
  @ApiResponse({ status: 200, description: 'Returns detailed approval information' })
  async findOne(@Param('id') id: string): Promise<ResponseDto<ApprovalResponseDto>> {
    return {
      data: await this.approvalsService.findOne(Number(id)),
    };
  }

  @Post(':id/decision')
  @ApiOperation({ summary: 'Submit approval decision' })
  @ApiResponse({ status: 200, description: 'Decision submitted successfully' })
  async submitDecision(
    @Param('id') id: string,
    @Body() decisionDto: ApprovalDecisionDto,
  ): Promise<ResponseDto<ApprovalResponseDto>> {
    return {
      data: await this.approvalsService.submitDecision(Number(id), decisionDto),
    };
  }
}
