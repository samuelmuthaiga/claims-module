import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LookupsService } from '../services/lookups.service';
import { ResponseDto } from '../../../common/dto/response.dto';

@ApiTags('lookups')
@Controller('v1/lookups')
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get('cars')
  @ApiOperation({ summary: 'Search vehicles' })
  @ApiResponse({ status: 200, description: 'Returns list of vehicles' })
  @ApiQuery({ name: 'searchType', required: false, enum: ['VIN', 'CAR_ID', 'PLATE_NUMBER', 'CUSTOMER_NAME', 'CUSTOMER_EMAIL', 'CUSTOMER_PHONE'] })
  @ApiQuery({ name: 'search', required: false })
  async searchCars(@Query('searchType') searchType?: string, @Query('search') search?: string): Promise<ResponseDto<any>> {
    return await this.lookupsService.searchCars(searchType, search);
  }

  @Get('enums')
  @ApiOperation({ summary: 'Get lookup enums' })
  @ApiResponse({ status: 200, description: 'Returns all lookup enums' })
  async getEnums(): Promise<ResponseDto<any>> {
    return {
      data: await this.lookupsService.getEnums(),
    };
  }

  @Get('countries')
  @ApiOperation({ summary: 'Get countries' })
  @ApiResponse({ status: 200, description: 'Returns list of countries' })
  async getCountries(): Promise<ResponseDto<any>> {
    return {
      data: await this.lookupsService.getCountries(),
    };
  }

  @Get('vendors')
  @ApiOperation({ summary: 'Get vendors' })
  @ApiResponse({ status: 200, description: 'Returns list of vendors' })
  async getVendors(): Promise<ResponseDto<any>> {
    return {
      data: await this.lookupsService.getVendors(),
    };
  }

  @Get('search-types')
  @ApiOperation({
    summary:
      'Get car search-type options for a claim type — options_source target for the claim-create form',
  })
  @ApiResponse({ status: 200, description: 'Returns search-by options' })
  @ApiQuery({ name: 'claimType', required: false, enum: ['WARRANTY', 'REPAIRS', 'INSURANCE'] })
  @ApiQuery({ name: 'warrantyType', required: false, enum: ['LOAN_WARRANTY', 'CASH_WARRANTY'] })
  async getSearchTypes(
    @Query('claimType') claimType?: string,
    @Query('warrantyType') warrantyType?: string,
  ): Promise<ResponseDto<any>> {
    return {
      data: this.lookupsService.getSearchTypes(claimType, warrantyType),
    };
  }
}
