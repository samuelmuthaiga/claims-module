import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormConfig } from '../entities/config.entity';
import { CLAIM_FORM_CONFIGS } from '../data/claim-form-configs.data';
import { ConfigMetadataValidator } from './config-metadata.validator';
import { CreateConfigDto } from '../dto/create-config.dto';
import { UpdateConfigDto } from '../dto/update-config.dto';
import { FormConfigResponseDto } from '../dto/config.dto';
import { SubmitConfigValuesResponseDto } from '../dto/submit-config-values.dto';

type MockConfig = Record<string, any>;

/**
 * Serves form configurations to the UI. Follows the codebase's standard
 * pattern: repository-first with an in-memory fallback so the UI works
 * before the claims database exists.
 */
@Injectable()
export class ConfigsService {
  /** In-memory store; seeded with the Claims UI form definitions. */
  private mockConfigs: MockConfig[] = CLAIM_FORM_CONFIGS.map((c) => ({
    ...c,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  constructor(
    @Optional() @InjectRepository(FormConfig)
    private readonly configRepository: Repository<FormConfig>,
    private readonly validator: ConfigMetadataValidator,
  ) {}

  private toResponse(config: MockConfig): FormConfigResponseDto {
    return {
      id: config.id,
      key: config.key,
      title: config.title,
      description: config.description ?? null,
      domain: config.domain ?? 'claims',
      metaData: config.metaData,
      actions: config.actions ?? null,
      isActive: config.isActive ?? true,
      version: config.version ?? 1,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private entityToResponse(entity: FormConfig): FormConfigResponseDto {
    return {
      id: entity.id,
      key: entity.key,
      title: entity.title,
      description: entity.description,
      domain: entity.domain,
      metaData: entity.metaData,
      actions: entity.actions,
      isActive: entity.isActive,
      version: entity.version,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  async findAll(domain?: string): Promise<FormConfigResponseDto[]> {
    try {
      const where = domain ? { domain } : {};
      const entities = await this.configRepository.find({ where });
      if (entities.length) {
        return entities.map((entity) => this.entityToResponse(entity));
      }
    } catch {
      // DB unavailable — fall through to mock configs.
    }

    return this.mockConfigs
      .filter((c) => !domain || c.domain === domain)
      .map((c) => this.toResponse(c));
  }

  /**
   * Fetch a form config by key. `context` (entityType/entityId/country/etc.)
   * is merged in so the UI can resolve {{context.*}} placeholders and the
   * server can evaluate context-keyed constraints on submit.
   */
  async findByKey(
    key: string,
    context: Record<string, unknown> = {},
  ): Promise<FormConfigResponseDto> {
    try {
      const entity = await this.configRepository.findOne({ where: { key } });
      if (entity) {
        const response = this.entityToResponse(entity);
        if (Object.keys(context).length) response.context = context;
        return response;
      }
    } catch {
      // DB unavailable — fall through to mock configs.
    }

    const config = this.mockConfigs.find((c) => c.key === key);
    if (!config) {
      throw new NotFoundException(`Form config '${key}' not found`);
    }

    const response = this.toResponse(config);
    if (Object.keys(context).length) response.context = context;
    return response;
  }

  async create(dto: CreateConfigDto): Promise<FormConfigResponseDto> {
    const schemaResult = this.validator.validateConfigSchema(dto.metaData);
    if (!schemaResult.ok) {
      throw new BadRequestException({
        message: 'Invalid meta_data schema',
        errors: schemaResult.errors,
      });
    }

    if (this.mockConfigs.some((c) => c.key === dto.key)) {
      throw new BadRequestException(
        `A config with key '${dto.key}' already exists`,
      );
    }

    const config: MockConfig = {
      id: `cfg-${dto.key}`,
      key: dto.key,
      title: dto.title,
      description: dto.description ?? null,
      domain: dto.domain ?? 'claims',
      metaData: dto.metaData,
      actions: dto.actions ?? null,
      isActive: dto.isActive ?? true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const entity = this.configRepository.create({
        key: config.key,
        title: config.title,
        description: config.description,
        domain: config.domain,
        metaData: config.metaData,
        actions: config.actions,
        isActive: config.isActive,
      });
      await this.configRepository.save(entity);
      return this.entityToResponse(entity);
    } catch {
      // DB unavailable — keep the config in the mock store.
    }

    this.mockConfigs.push(config);
    return this.toResponse(config);
  }

  async update(
    key: string,
    dto: UpdateConfigDto,
  ): Promise<FormConfigResponseDto> {
    if (dto.metaData) {
      const schemaResult = this.validator.validateConfigSchema(dto.metaData);
      if (!schemaResult.ok) {
        throw new BadRequestException({
          message: 'Invalid meta_data schema',
          errors: schemaResult.errors,
        });
      }
    }

    try {
      const entity = await this.configRepository.findOne({ where: { key } });
      if (entity) {
        if (dto.title !== undefined) entity.title = dto.title;
        if (dto.description !== undefined) entity.description = dto.description;
        if (dto.metaData !== undefined) entity.metaData = dto.metaData;
        if (dto.actions !== undefined) entity.actions = dto.actions;
        if (dto.isActive !== undefined) entity.isActive = dto.isActive;
        entity.version = (entity.version ?? 1) + 1;
        await this.configRepository.save(entity);
        return this.entityToResponse(entity);
      }
    } catch {
      // DB unavailable — fall through to mock configs.
    }

    const index = this.mockConfigs.findIndex((c) => c.key === key);
    if (index === -1) {
      throw new NotFoundException(`Form config '${key}' not found`);
    }

    const existing = this.mockConfigs[index]!;
    this.mockConfigs[index] = {
      ...existing,
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.metaData !== undefined && { metaData: dto.metaData }),
      ...(dto.actions !== undefined && { actions: dto.actions }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      version: (existing.version ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    };

    return this.toResponse(this.mockConfigs[index]);
  }

  /**
   * Validates submitted values against the config's metaData and returns the
   * result in Fleetzen's submit contract — { ok, errors[], metaData } — so the
   * UI can map errors onto fields the same way mapSubmissionErrors does.
   */
  async submitValues(
    key: string,
    values: Record<string, unknown>,
    context: Record<string, unknown> = {},
  ): Promise<SubmitConfigValuesResponseDto> {
    const config = await this.findByKey(key);

    if (!config.isActive) {
      throw new BadRequestException(`Form config '${key}' is not active`);
    }

    const result = this.validator.validateAndApplyConfigMeta(
      config.metaData,
      values,
      context,
    );

    return {
      ok: result.ok,
      errors: result.errors,
      metaData: result.metaData,
      submission: result.ok
        ? {
            configKey: key,
            values,
            context,
            submittedAt: new Date().toISOString(),
          }
        : undefined,
    };
  }
}
