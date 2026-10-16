import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigsService } from '../services/configs.service';
import { CreateConfigDto } from '../dto/create-config.dto';
import { UpdateConfigDto } from '../dto/update-config.dto';
import { FormConfigResponseDto } from '../dto/config.dto';
import {
  SubmitConfigValuesDto,
  SubmitConfigValuesResponseDto,
} from '../dto/submit-config-values.dto';
import { ResponseDto } from '../../../common/dto/response.dto';

@ApiTags('configs')
@Controller('v1/configs')
export class ConfigsController {
  constructor(private readonly configsService: ConfigsService) {}

  @Get()
  @ApiOperation({ summary: 'List form configurations' })
  @ApiQuery({ name: 'domain', required: false, example: 'claims' })
  @ApiResponse({ status: 200, description: 'Returns form config templates' })
  async findAll(
    @Query('domain') domain?: string,
  ): Promise<ResponseDto<FormConfigResponseDto[]>> {
    return { data: await this.configsService.findAll(domain) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a form config (validates metaData schema)' })
  @ApiResponse({ status: 201, description: 'Config created' })
  @ApiResponse({ status: 400, description: 'Invalid meta_data schema or duplicate key' })
  async create(
    @Body() dto: CreateConfigDto,
  ): Promise<ResponseDto<FormConfigResponseDto>> {
    return { data: await this.configsService.create(dto) };
  }

  @Get(':key')
  @ApiOperation({
    summary:
      'Get a form config by key. Pass entity context as query params to hydrate {{context.*}} placeholders (e.g. ?entityType=claim&entityId=123&country=NG).',
  })
  @ApiResponse({ status: 200, description: 'Returns the form config' })
  @ApiResponse({ status: 404, description: 'Config not found' })
  async findByKey(
    @Param('key') key: string,
    @Query() context: Record<string, unknown>,
  ): Promise<ResponseDto<FormConfigResponseDto>> {
    return { data: await this.configsService.findByKey(key, context) };
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a form config (validates metaData schema)' })
  @ApiResponse({ status: 200, description: 'Config updated' })
  @ApiResponse({ status: 400, description: 'Invalid meta_data schema' })
  @ApiResponse({ status: 404, description: 'Config not found' })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
  ): Promise<ResponseDto<FormConfigResponseDto>> {
    return { data: await this.configsService.update(key, dto) };
  }

  @Post(':key/submit')
  @ApiOperation({
    summary:
      'Validate submitted form values against the config. Returns { ok, errors[], metaData } — errors are keyed by field so the UI can map them directly onto the form.',
  })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async submitValues(
    @Param('key') key: string,
    @Body() dto: SubmitConfigValuesDto,
  ): Promise<ResponseDto<SubmitConfigValuesResponseDto>> {
    return {
      data: await this.configsService.submitValues(
        key,
        dto.values,
        dto.context,
      ),
    };
  }
}
