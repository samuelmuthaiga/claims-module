import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../../../common/decorators/api-auth.decorator';
import { ApiOkEnvelope } from '../../../common/decorators/api-response.decorator';
import { CarSearchQueryDto, CitiesQueryDto, SearchTypesQueryDto, StatesQueryDto, VendorsQueryDto } from '../dto/lookups-query.dto';
import { LookupsService } from '../services/lookups.service';

@ApiTags('lookups')
@ApiAuth()
@Controller('v1/lookups')
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  @Get('cars')
  @ApiOperation({ summary: 'Search vehicles for the new-claim modal (with per-claim-type eligibility)' })
  @ApiOkEnvelope('Paginated vehicles')
  cars(@Query() query: CarSearchQueryDto) {
    return this.lookups.searchCars(query);
  }

  @Get('enums')
  @ApiOperation({ summary: 'Every option list (claim types, statuses, categories, …) — also the source of form/filter options' })
  @ApiOkEnvelope('Enums')
  enums() {
    return this.lookups.enums();
  }

  @Get('countries')
  @ApiOperation({ summary: 'Countries with currency, symbol, exponent and timezone' })
  @ApiOkEnvelope('Countries')
  countries() {
    return this.lookups.countries();
  }

  @Get('vendors')
  @ApiOperation({ summary: 'Workshops (active only by default)' })
  @ApiOkEnvelope('Vendors')
  vendors(@Query() query: VendorsQueryDto) {
    return this.lookups.vendors(query);
  }

  @Get('states')
  @ApiOperation({ summary: 'States / regions for a country' })
  @ApiOkEnvelope('States')
  states(@Query() query: StatesQueryDto) {
    return this.lookups.states(query);
  }

  @Get('cities')
  @ApiOperation({ summary: 'Cities for a country (optionally one state)' })
  @ApiOkEnvelope('Cities')
  cities(@Query() query: CitiesQueryDto) {
    return this.lookups.cities(query);
  }

  @Get('search-types')
  @ApiOperation({ summary: 'Car search-by options for a claim type (options_source of the claim-create form)' })
  @ApiOkEnvelope('Search types')
  searchTypes(@Query() query: SearchTypesQueryDto) {
    return this.lookups.searchTypes(query);
  }
}
