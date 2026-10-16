import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Permission } from '../../../auth/constants/permissions';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { ApiAuth } from '../../../common/decorators/api-auth.decorator';
import { ApiOkEnvelope } from '../../../common/decorators/api-response.decorator';
import { ConfigBootstrapDto, ConfigResponseDto } from '../dto/config.dto';
import { BootstrapQueryDto, GetConfigQueryDto, ListConfigsQueryDto } from '../dto/config-query.dto';
import { CreateConfigDto } from '../dto/create-config.dto';
import { SubmitConfigValuesDto, SubmitConfigValuesResponseDto } from '../dto/submit-config-values.dto';
import { UpdateConfigDto } from '../dto/update-config.dto';
import { ConfigsService } from '../services/configs.service';

@ApiTags('configs')
@ApiAuth()
@Controller('v1/configs')
export class ConfigsController {
  constructor(private readonly configs: ConfigsService) {}

  @Get()
  @RequirePermissions(Permission.CONFIGS_READ)
  @ApiOperation({ summary: 'List UI configurations (forms, filters, tables, workflow, settings)' })
  @ApiOkEnvelope('Configs', ConfigResponseDto, true)
  list(@Query() query: ListConfigsQueryDto) {
    return this.configs.list(query);
  }

  @Get('bootstrap')
  @RequirePermissions(Permission.CONFIGS_READ)
  @ApiOperation({
    summary: 'Every active config in one call, with an etag',
    description: 'Load once at login. Send the etag back as If-None-Match to get 304 when nothing changed. `GET /v1/auth/me` returns the same etag as `configEtag`.',
  })
  @ApiOkEnvelope('Config bundle', ConfigBootstrapDto)
  bootstrap(
    @Query() query: BootstrapQueryDto,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const bundle = this.configs.bootstrap(query.country);
    res.setHeader('ETag', `"${bundle.etag}"`);
    res.setHeader('Cache-Control', 'private, no-cache');
    if (ifNoneMatch?.replace(/"/g, '') === bundle.etag) {
      res.status(304);
      return undefined;
    }
    return bundle;
  }

  @Get(':key')
  @RequirePermissions(Permission.CONFIGS_READ)
  @ApiOperation({
    summary: 'Get one config by key',
    description: 'Pass `entityType` + `entityId` (e.g. claim/1024) to receive the hydrated `context` and server-computed `initialValues`.',
  })
  @ApiOkEnvelope('Config', ConfigResponseDto)
  get(@Param('key') key: string, @Query() query: GetConfigQueryDto) {
    return this.configs.get(key, query);
  }

  @Post()
  @RequirePermissions(Permission.CONFIGS_MANAGE)
  @ApiOperation({ summary: 'Create a config (schema is validated per type)' })
  @ApiOkEnvelope('Config created', ConfigResponseDto)
  create(@Body() dto: CreateConfigDto, @CurrentUser() user: AuthUser) {
    return this.configs.create(dto, user);
  }

  @Patch(':key')
  @RequirePermissions(Permission.CONFIGS_MANAGE)
  @ApiOperation({ summary: 'Update a config; bumps its version and etag' })
  @ApiOkEnvelope('Config updated', ConfigResponseDto)
  update(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @Query('country') country: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.configs.update(key, dto, country, user);
  }

  @Post(':key/submit')
  @HttpCode(200)
  @RequirePermissions(Permission.CONFIGS_READ)
  @ApiOperation({
    summary: 'Validate form values against a config (dry run)',
    description: 'Returns `{ ok, errors[{key,message}], metaData }`. Errors are keyed by field so they map straight onto the form; repeatable groups use `lineItems.0.quantity`-style keys.',
  })
  @ApiOkEnvelope('Validation result', SubmitConfigValuesResponseDto)
  submit(@Param('key') key: string, @Body() dto: SubmitConfigValuesDto) {
    const { ok, errors, metaData } = this.configs.validate(key, dto.values, dto.context ?? {});
    return { ok, errors, metaData };
  }
}
