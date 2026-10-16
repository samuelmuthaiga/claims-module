import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '../../../auth/constants/permissions';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { ApiAuth } from '../../../common/decorators/api-auth.decorator';
import { ApiOkEnvelope } from '../../../common/decorators/api-response.decorator';
import { PartsPricingQueryDto } from '../dto/parts-pricing-query.dto';
import { PartsPricingService } from '../services/parts-pricing.service';

@ApiTags('parts-pricing')
@ApiAuth()
@RequirePermissions(Permission.PARTS_READ)
@Controller('v1/parts-pricing')
export class PartsPricingController {
  constructor(private readonly parts: PartsPricingService) {}

  @Get()
  @ApiOperation({ summary: 'Approved part prices (benchmark history), newest first by default' })
  @ApiOkEnvelope('Paginated part prices')
  list(@Query() query: PartsPricingQueryDto) {
    return this.parts.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One part price record' })
  @ApiOkEnvelope('Part price')
  get(@Param('id', new ParseIntPipe({ errorHttpStatusCode: 422 })) id: number) {
    return this.parts.get(id);
  }
}
