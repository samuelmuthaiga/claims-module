import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ClaimsService } from '../services/claims.service';
import { CreateClaimDto } from '../dto/create-claim.dto';
import { ClaimResponseDto } from '../dto/claim-response.dto';
import { ClaimSummaryResponseDto } from '../dto/claim-summary-response.dto';
import { ClaimDetailResponseDto } from '../dto/claim-detail-response.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ResponseDto } from '../../../common/dto/response.dto';

@ApiTags('claims')
@Controller('v1/claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  @ApiOperation({ summary: 'List claims' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of claims' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Query() pagination: PaginationDto): Promise<ResponseDto<ClaimResponseDto[]>> {
    const { page = 1, limit = 10 } = pagination;
    return await this.claimsService.findAll(page, limit);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get claims summary (dashboard counters)' })
  @ApiResponse({ status: 200, description: 'Returns dashboard summary counts' })
  async getSummary(): Promise<ResponseDto<ClaimSummaryResponseDto>> {
    return {
      data: await this.claimsService.getSummary(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get claim detail' })
  @ApiResponse({ status: 200, description: 'Returns detailed claim information' })
  async findOne(@Param('id') id: string): Promise<ResponseDto<ClaimDetailResponseDto>> {
    return {
      data: await this.claimsService.findOne(Number(id)),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create new claim' })
  @ApiResponse({ status: 201, description: 'Claim created successfully' })
  async create(@Body() createClaimDto: CreateClaimDto): Promise<ResponseDto<any>> {
    return {
      data: await this.claimsService.create(createClaimDto),
    };
  }
}
