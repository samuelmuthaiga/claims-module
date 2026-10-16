import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { ClaimsException, ErrorCode } from '../../../common/exceptions/claims.exception';
import { AuditService } from '../../audit-logs/services/audit.service';
import { DEFAULT_CONFIGS } from '../data';
import { DEFAULT_SETTINGS } from '../data/settings.config';
import { DEFAULT_WORKFLOW } from '../data/workflow.config';
import { CreateConfigDto } from '../dto/create-config.dto';
import { ConfigResponseDto } from '../dto/config.dto';
import { UpdateConfigDto } from '../dto/update-config.dto';
import {
  ClaimsSettings, ConfigDefinition, ConfigSeed, ConfigType, WorkflowDefinition,
} from '../types/config.types';
import { ConfigContextService } from './config-context.service';
import { ConfigMetadataValidator, ValidationResult } from './config-metadata.validator';

const hash = (input: string): string => createHash('sha1').update(input).digest('hex').slice(0, 16);

/**
 * Registry of UI configurations (forms, filter bars, tables, workflow,
 * settings). Held in memory and seeded from `data/` until the claims DB
 * exists; `entities/config.entity.ts` is the table it moves to. Every seed is
 * schema-validated at boot, so a broken default fails the deploy, not a user.
 */
@Injectable()
export class ConfigsService implements OnModuleInit {
  private readonly logger = new Logger(ConfigsService.name);
  private readonly registry = new Map<string, ConfigDefinition>();

  constructor(
    private readonly validator: ConfigMetadataValidator,
    private readonly contextService: ConfigContextService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    const formKeys = new Set(DEFAULT_CONFIGS.filter((c) => c.type === 'FORM').map((c) => c.key));
    for (const seed of DEFAULT_CONFIGS) {
      const result = this.validator.validateConfigSchema(seed.type, seed.metaData, formKeys);
      if (!result.ok) {
        throw new Error(
          `Invalid default config '${seed.key}': ${result.errors.map((e) => `${e.key}: ${e.message}`).join('; ')}`,
        );
      }
      this.registry.set(this.slot(seed.key, seed.country ?? '*'), this.build(seed, 1));
    }
    this.logger.log(`Loaded ${this.registry.size} default configs`);
  }

  // ───────────────────────────── reads ─────────────────────────────

  list(filter: { type?: string; domain?: string; country?: string } = {}): ConfigResponseDto[] {
    return this.active()
      .filter((c) => (!filter.type || c.type === filter.type) && (!filter.domain || c.domain === filter.domain))
      .filter((c) => !filter.country || c.country === '*' || c.country === filter.country)
      .map((c) => this.toResponse(c));
  }

  get(
    key: string,
    options: { country?: string; entityType?: string; entityId?: string } = {},
  ): ConfigResponseDto {
    const config = this.find(key, options.country);
    const response = this.toResponse(config);
    if (options.entityType) {
      const { context, initialValues } = this.contextService.resolve(key, options.entityType, options.entityId);
      response.context = context;
      response.initialValues = initialValues;
    }
    return response;
  }

  bootstrap(country?: string): { etag: string; generatedAt: string; configs: ConfigResponseDto[] } {
    const configs = this.list({ country }).filter((c) => c.country === '*' || c.country === country);
    // Country-specific entries replace the global entry of the same key.
    const byKey = new Map<string, ConfigResponseDto>();
    configs.forEach((c) => {
      if (!byKey.has(c.key) || c.country !== '*') byKey.set(c.key, c);
    });
    const selected = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
    return {
      etag: hash(selected.map((c) => c.etag).join('|')),
      generatedAt: new Date().toISOString(),
      configs: selected,
    };
  }

  getEtag(): string {
    return this.bootstrap().etag;
  }

  getSettings(): ClaimsSettings {
    const stored = this.registry.get(this.slot('claims-settings', '*'))?.metaData as Partial<ClaimsSettings> | undefined;
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  getWorkflow(): WorkflowDefinition {
    return (this.registry.get(this.slot('claim-workflow', '*'))?.metaData as unknown as WorkflowDefinition) ?? DEFAULT_WORKFLOW;
  }

  // ───────────────────────────── validation ─────────────────────────────

  /** Dry-run validation of form values (what the UI calls before submitting). */
  validate(key: string, values: Record<string, unknown>, context: Record<string, unknown> = {}): ValidationResult {
    const config = this.find(key);
    return this.validator.validateAndApplyConfigMeta(config.metaData, values, context);
  }

  /**
   * Validates an API payload against its form config and throws a
   * `422 VALIDATION_FAILED` with field-keyed errors. UI-only (`transient`)
   * fields are ignored, so the config stays the single source of validation
   * rules for both the form and the endpoint it posts to.
   */
  assertValid(key: string, payload: Record<string, unknown>, context: Record<string, unknown> = {}): void {
    const config = this.find(key);
    const result = this.validator.validateAndApplyConfigMeta(config.metaData, payload, context, { skipTransient: true });
    if (!result.ok) throw ClaimsException.validation(result.errors);
  }

  // ───────────────────────────── writes ─────────────────────────────

  create(dto: CreateConfigDto, actor?: AuthUser): ConfigResponseDto {
    const country = dto.country ?? '*';
    const slot = this.slot(dto.key, country);
    if (this.registry.has(slot)) {
      throw ClaimsException.conflict(ErrorCode.INVALID_TRANSITION, `A config with key '${dto.key}' already exists for country '${country}'`);
    }
    this.assertSchema(dto.type, dto.metaData);

    const config = this.build(
      { key: dto.key, type: dto.type, title: dto.title, description: dto.description, domain: dto.domain ?? 'claims', country, metaData: dto.metaData, actions: dto.actions as unknown as ConfigSeed['actions'] },
      1,
      dto.isActive ?? true,
    );
    this.registry.set(slot, config);
    this.audit.record(
      { module: 'CONFIGS', action: 'CONFIG_CREATED', entityType: 'config', entityId: config.key, details: `Created ${config.type} config '${config.key}'`, after: { version: 1 } },
      actor,
    );
    return this.toResponse(config);
  }

  update(key: string, dto: UpdateConfigDto, country = '*', actor?: AuthUser): ConfigResponseDto {
    const slot = this.slot(key, country);
    const existing = this.registry.get(slot);
    if (!existing) throw ClaimsException.notFound('Config', key);
    if (dto.metaData) this.assertSchema(existing.type, dto.metaData);

    const next: ConfigDefinition = {
      ...existing,
      title: dto.title ?? existing.title,
      description: dto.description ?? existing.description,
      metaData: dto.metaData ?? existing.metaData,
      actions: (dto.actions as unknown as ConfigDefinition['actions']) ?? existing.actions,
      isActive: dto.isActive ?? existing.isActive,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    next.etag = this.etagOf(next);
    this.registry.set(slot, next);
    this.audit.record(
      { module: 'CONFIGS', action: 'CONFIG_UPDATED', entityType: 'config', entityId: key, details: `Updated config '${key}' to v${next.version}`, before: { version: existing.version, etag: existing.etag }, after: { version: next.version, etag: next.etag } },
      actor,
    );
    return this.toResponse(next);
  }

  // ───────────────────────────── internals ─────────────────────────────

  private assertSchema(type: ConfigType, metaData: Record<string, unknown>): void {
    const formKeys = new Set([...this.registry.values()].filter((c) => c.type === 'FORM').map((c) => c.key));
    const result = this.validator.validateConfigSchema(type, metaData, formKeys);
    if (!result.ok) throw ClaimsException.validation(result.errors, 'Invalid config metaData schema');
  }

  private find(key: string, country?: string): ConfigDefinition {
    const config =
      (country ? this.registry.get(this.slot(key, country)) : undefined) ?? this.registry.get(this.slot(key, '*'));
    if (!config || !config.isActive) throw ClaimsException.notFound('Config', key);
    return config;
  }

  private active(): ConfigDefinition[] {
    return [...this.registry.values()].filter((c) => c.isActive);
  }

  private slot(key: string, country: string): string {
    return `${key}|${country}`;
  }

  private etagOf(config: Pick<ConfigDefinition, 'key' | 'version' | 'metaData' | 'actions'>): string {
    return hash(`${config.key}:${config.version}:${JSON.stringify(config.metaData)}:${JSON.stringify(config.actions)}`);
  }

  private build(seed: ConfigSeed, version: number, isActive = true): ConfigDefinition {
    const now = new Date().toISOString();
    const config: ConfigDefinition = {
      id: `cfg-${seed.key}`,
      key: seed.key,
      type: seed.type,
      title: seed.title,
      description: seed.description ?? null,
      domain: seed.domain,
      country: seed.country ?? '*',
      metaData: seed.metaData,
      actions: seed.actions ?? null,
      isActive,
      version,
      etag: '',
      createdAt: now,
      updatedAt: now,
    };
    config.etag = this.etagOf(config);
    return config;
  }

  private toResponse(config: ConfigDefinition): ConfigResponseDto {
    return { ...config, metaData: JSON.parse(JSON.stringify(config.metaData)) };
  }
}
