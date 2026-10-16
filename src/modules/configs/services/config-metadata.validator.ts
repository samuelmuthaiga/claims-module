import { Injectable } from '@nestjs/common';
import { ConfigInputType } from '../enums/config-input-type.enum';
import { ConfigType } from '../types/config.types';

export interface ConfigValidationError {
  key: string;
  message: string;
}

export interface SchemaValidationResult {
  ok: boolean;
  errors: ConfigValidationError[];
}

export interface ValidationResult extends SchemaValidationResult {
  metaData: Record<string, any> | undefined;
}

export interface ValidateOptions {
  /** Skip UI-only fields (`transient: true`) — used when validating an API payload. */
  skipTransient?: boolean;
}

type Rec = Record<string, any>;

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  multipleOf?: number;
  allowedValues?: unknown[];
  minDate?: string;
  maxDate?: string;
  minCount?: number;
  maxCount?: number;
  maxFileSizeMb?: number;
  allowedFileTypes?: string[];
  email?: boolean;
  phone?: boolean;
  url?: boolean;
  numeric?: boolean;
  messages?: Record<string, string>;
}

/**
 * Conditional rule used by `visible_if` and `required_if`.
 * `source: 'context'` reads the entity context (e.g. repairFinanced) instead of
 * a form value. Same semantics as Fleetzen's fieldRules.ts, plus the source.
 */
export interface ConditionalRule {
  field?: string;
  source?: 'context' | 'values';
  equals?: unknown;
  not_equals?: unknown;
  in?: unknown[];
  not_in?: unknown[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d][\d\s\-()]+$/;
const URL_REGEX = /^https?:\/\/\S+$/;
const FIELD_TYPES = new Set<string>(Object.values(ConfigInputType));
const TABLE_FORMATS = new Set(['text', 'badge', 'currency', 'date', 'datetime', 'person', 'vehicle', 'number']);

const text = (value: unknown): string => String(value ?? '');
const isRecord = (value: unknown): value is Rec =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const getPath = (source: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, part) => (isRecord(acc) ? acc[part] : undefined), source);

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) {
    return (
      value.length === 0 ||
      value.every((item) => isEmptyValue(item) || (isRecord(item) && 'url' in item && isEmptyValue(item.url)))
    );
  }
  if (isRecord(value)) {
    if ('url' in value) return isEmptyValue(value.url);
    return Object.keys(value).length === 0;
  }
  return false;
}

export function evaluateRule(
  rule: ConditionalRule | undefined,
  scope: Rec,
  context: Rec,
): boolean {
  if (!rule?.field) return false;
  const source = rule.source === 'context' ? context : scope;
  const other = getPath(source, rule.field);
  // The rule only applies once the referenced value has been answered.
  if (isEmptyValue(other)) return false;

  const answer = text(other);
  if (rule.equals !== undefined) return answer === text(rule.equals);
  if (rule.not_equals !== undefined) return answer !== text(rule.not_equals);
  if (Array.isArray(rule.in)) return rule.in.map(text).includes(answer);
  if (Array.isArray(rule.not_in)) return !rule.not_in.map(text).includes(answer);
  return false;
}

const message = (rule: ValidationRule, key: string, fallback: string): string =>
  rule.messages?.[key] || fallback;

const optionValues = (options: unknown[]): Set<string> =>
  new Set(options.map((opt) => (isRecord(opt) ? text(opt.value) : text(opt))));

const hasExtension = (url: string, allowed: string[]): boolean => {
  const lower = url.split('?')[0]!.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext.toLowerCase()));
};

const fileUrls = (value: unknown): string[] => {
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => (isRecord(item) ? item.url : item))
    .filter((item): item is string => typeof item === 'string');
};

/**
 * Validates config schemas (per config type) and applies/validates submitted
 * values against FORM/FILTERS schemas. Ported from micro-fleetzen-service's
 * ConfigMetadataValidator with claims fixes: nested + repeatable groups are
 * validated against their own scope, rules can read the entity context, and
 * cross-field constraints are supported.
 */
@Injectable()
export class ConfigMetadataValidator {
  // ───────────────────────────── schema validation ─────────────────────────────

  validateConfigSchema(type: ConfigType, metaData: Rec | undefined, knownFormKeys?: Set<string>): SchemaValidationResult {
    const errors: ConfigValidationError[] = [];
    if (!isRecord(metaData)) {
      return { ok: false, errors: [{ key: '(root)', message: 'metaData must be an object' }] };
    }

    switch (type) {
      case 'FORM':
      case 'FILTERS':
        this.validateFieldContainer(metaData, errors);
        if (type === 'FILTERS') this.validateSearchTypes(metaData, errors);
        break;
      case 'TABLE':
        this.validateTable(metaData, errors);
        break;
      case 'WORKFLOW':
        this.validateWorkflow(metaData, errors, knownFormKeys);
        break;
      case 'SETTINGS':
        if (Object.keys(metaData).length === 0) {
          errors.push({ key: '(root)', message: 'settings must not be empty' });
        }
        break;
    }
    return { ok: errors.length === 0, errors };
  }

  private validateSearchTypes(meta: Rec, errors: ConfigValidationError[]): void {
    if (meta.searchTypes === undefined) return;
    if (!Array.isArray(meta.searchTypes)) {
      errors.push({ key: 'searchTypes', message: 'searchTypes must be an array' });
      return;
    }
    meta.searchTypes.forEach((entry: Rec, index: number) => {
      if (!entry?.value || !entry?.label) {
        errors.push({ key: `searchTypes.${index}`, message: 'searchTypes entries need value and label' });
      }
    });
  }

  private validateFieldContainer(meta: Rec, errors: ConfigValidationError[]): void {
    const hasFields = Array.isArray(meta.fields) && meta.fields.length > 0;
    const hasSections = Array.isArray(meta.sections) && meta.sections.length > 0;
    if (!hasFields && !hasSections) {
      errors.push({ key: '(root)', message: 'metaData must include sections[] or fields[]' });
      return;
    }

    const scopeFields = this.collectScopeFields(meta);
    const seen = new Set<string>();
    scopeFields.forEach((field) => this.validateField(field, scopeFields, seen, errors));

    if (Array.isArray(meta.sections)) {
      meta.sections.forEach((section: Rec) => {
        if (!Array.isArray(section?.fields)) {
          errors.push({ key: section?.key ?? '(section)', message: 'sections entries must include fields[]' });
        }
      });
    }
    this.validateConstraintRefs(meta, scopeFields, errors);
  }

  private collectScopeFields(container: Rec): Rec[] {
    const own = Array.isArray(container.fields) ? container.fields : [];
    const sectioned = Array.isArray(container.sections)
      ? container.sections.flatMap((section: Rec) => (Array.isArray(section?.fields) ? section.fields : []))
      : [];
    return [...own, ...sectioned];
  }

  private validateField(field: Rec, scope: Rec[], seen: Set<string>, errors: ConfigValidationError[]): void {
    if (!isRecord(field)) return;
    const key = typeof field.key === 'string' ? field.key.trim() : '';
    const at = key || '(unknown)';

    if (!key) errors.push({ key: at, message: 'Field key is required' });
    else if (seen.has(key)) errors.push({ key, message: 'Duplicate field key found in schema' });
    else seen.add(key);

    if (!String(field.label ?? '').trim()) errors.push({ key: at, message: 'Field label is required' });

    const type = typeof field.type === 'string' ? field.type : undefined;
    if (!type) {
      errors.push({ key: at, message: 'Field type is required' });
      return;
    }
    if (!FIELD_TYPES.has(type)) {
      errors.push({ key: at, message: `Unsupported field type: ${type}` });
      return;
    }

    if ([ConfigInputType.SELECT, ConfigInputType.MULTISELECT, ConfigInputType.RADIO].includes(type as ConfigInputType)) {
      this.validateOptions(field, at, errors);
    }

    if (type === ConfigInputType.GROUP) {
      if (!Array.isArray(field.fields) || field.fields.length === 0) {
        errors.push({ key: at, message: 'group fields require a non-empty fields[]' });
      } else {
        const childSeen = new Set<string>();
        field.fields.forEach((child: Rec) => this.validateField(child, field.fields, childSeen, errors));
      }
    }

    // Rules must point at fields that exist in the same scope (or the context).
    const scopeKeys = new Set(scope.map((f) => f?.key));
    for (const ruleName of ['visible_if', 'required_if'] as const) {
      const rule = field[ruleName] as ConditionalRule | undefined;
      if (!rule) continue;
      if (!rule.field) errors.push({ key: at, message: `${ruleName} requires a field` });
      else if (rule.source !== 'context' && !scopeKeys.has(rule.field)) {
        errors.push({ key: at, message: `${ruleName} references unknown field '${rule.field}'` });
      }
    }
    for (const refName of ['dependsOn', 'clearsOnChange'] as const) {
      if (field[refName] !== undefined && !Array.isArray(field[refName])) {
        errors.push({ key: at, message: `${refName} must be an array of field keys` });
      }
    }
  }

  private validateOptions(field: Rec, key: string, errors: ConfigValidationError[]): void {
    const hasOptions = Array.isArray(field.options) && field.options.length > 0;
    const source = field.options_source;
    let hasSource = false;

    if (source !== undefined && source !== null) {
      if (typeof source === 'string') hasSource = source.trim().length > 0;
      else if (!isRecord(source)) errors.push({ key, message: 'options_source must be a string or object' });
      else {
        const url = typeof source.url === 'string' ? source.url.trim() : '';
        const fullUrl = typeof source.fullUrl === 'string' ? source.fullUrl.trim() : '';
        hasSource = Boolean(url || fullUrl);
        if (!hasSource) errors.push({ key, message: 'options_source must provide at least one of url or fullUrl' });
        if (url && !url.startsWith('/')) errors.push({ key, message: 'options_source.url must start with /' });
        if (fullUrl && !URL_REGEX.test(fullUrl)) {
          errors.push({ key, message: 'options_source.fullUrl must be absolute http/https URL' });
        }
      }
    }

    if (!hasOptions && !hasSource) {
      errors.push({ key, message: 'options or options_source is required for select/radio fields' });
    }

    if (hasOptions) {
      const seen = new Set<string>();
      (field.options as unknown[]).forEach((opt, index) => {
        const value = isRecord(opt) ? text(opt.value).trim() : text(opt).trim();
        if (!value) errors.push({ key, message: `options[${index}] must have a non-empty value` });
        else if (seen.has(value)) errors.push({ key, message: `Duplicate option value '${value}' found in options[]` });
        else seen.add(value);
        if (isRecord(opt) && 'label' in opt && !text(opt.label).trim()) {
          errors.push({ key, message: `options[${index}] must have a non-empty label` });
        }
      });
    }
  }

  private validateConstraintRefs(meta: Rec, scopeFields: Rec[], errors: ConfigValidationError[]): void {
    if (meta.constraints === undefined) return;
    if (!Array.isArray(meta.constraints)) {
      errors.push({ key: 'constraints', message: 'constraints must be an array' });
      return;
    }
    const roots = new Set(scopeFields.map((f) => f?.key));
    const known = (path: unknown): boolean => typeof path === 'string' && roots.has(path.split('.')[0]);

    meta.constraints.forEach((constraint: Rec, index: number) => {
      const at = `constraints.${index}`;
      if (constraint?.type === 'sum') {
        if (!Array.isArray(constraint.fields) || !constraint.fields.every(known)) {
          errors.push({ key: at, message: 'sum constraint fields must reference existing fields' });
        }
        if (constraint.equals === undefined && constraint.contextKey === undefined && constraint.value === undefined) {
          errors.push({ key: at, message: 'sum constraint needs equals, contextKey or value' });
        }
      } else if (constraint?.type === 'lte') {
        if (!known(constraint.field)) errors.push({ key: at, message: 'lte constraint field must reference an existing field' });
        if (constraint.max === undefined) errors.push({ key: at, message: 'lte constraint needs max' });
      } else if (constraint?.type === 'sumRows') {
        if (!known(constraint.collection)) errors.push({ key: at, message: 'sumRows collection must reference an existing field' });
        if (!Array.isArray(constraint.multiply) || constraint.multiply.length === 0) {
          errors.push({ key: at, message: 'sumRows needs multiply[]' });
        }
      } else {
        errors.push({ key: at, message: `Unsupported constraint type: ${constraint?.type}` });
      }
    });
  }

  private validateTable(meta: Rec, errors: ConfigValidationError[]): void {
    if (typeof meta.endpoint !== 'string' || !meta.endpoint.startsWith('/')) {
      errors.push({ key: 'endpoint', message: 'table endpoint must be a relative path starting with /' });
    }
    if (!Array.isArray(meta.columns) || meta.columns.length === 0) {
      errors.push({ key: 'columns', message: 'table must define columns[]' });
      return;
    }
    const seen = new Set<string>();
    meta.columns.forEach((column: Rec, index: number) => {
      const at = column?.key ?? `columns.${index}`;
      if (!column?.key) errors.push({ key: at, message: 'Column key is required' });
      else if (seen.has(column.key)) errors.push({ key: at, message: 'Duplicate column key' });
      else seen.add(column.key);
      if (!column?.label) errors.push({ key: at, message: 'Column label is required' });
      if (!column?.path) errors.push({ key: at, message: 'Column path is required' });
      if (column?.format && !TABLE_FORMATS.has(column.format)) {
        errors.push({ key: at, message: `Unsupported column format: ${column.format}` });
      }
    });
  }

  private validateWorkflow(meta: Rec, errors: ConfigValidationError[], knownFormKeys?: Set<string>): void {
    const statuses = new Set<string>();
    (Array.isArray(meta.statuses) ? meta.statuses : []).forEach((status: Rec) => {
      if (!status?.code || !status?.label) errors.push({ key: 'statuses', message: 'Every status needs code and label' });
      else if (statuses.has(status.code)) errors.push({ key: status.code, message: 'Duplicate status code' });
      else statuses.add(status.code);
    });
    if (statuses.size === 0) errors.push({ key: 'statuses', message: 'workflow must define statuses[]' });

    if (!isRecord(meta.rails) || Object.keys(meta.rails).length === 0) {
      errors.push({ key: 'rails', message: 'workflow must define rails' });
    } else {
      for (const [claimType, rail] of Object.entries(meta.rails)) {
        (Array.isArray(rail) ? rail : []).forEach((code) => {
          if (!statuses.has(code)) errors.push({ key: `rails.${claimType}`, message: `Unknown status '${code}' in rail` });
        });
      }
    }

    const seenActions = new Set<string>();
    (Array.isArray(meta.actions) ? meta.actions : []).forEach((action: Rec) => {
      const at = action?.action ?? '(action)';
      if (!action?.action || !action?.label) errors.push({ key: at, message: 'Every action needs action and label' });
      else if (seenActions.has(action.action)) errors.push({ key: at, message: 'Duplicate action' });
      else seenActions.add(action.action);
      if (!Array.isArray(action?.from) || action.from.length === 0) {
        errors.push({ key: at, message: 'action.from must list at least one status' });
      } else {
        action.from.forEach((code: string) => {
          if (!statuses.has(code)) errors.push({ key: at, message: `Unknown status '${code}' in action.from` });
        });
      }
      if (!action?.permission) errors.push({ key: at, message: 'action.permission is required' });
      if (typeof action?.endpoint !== 'string' || !action.endpoint.startsWith('/')) {
        errors.push({ key: at, message: 'action.endpoint must start with /' });
      }
      if (action?.inputSchemaRef && knownFormKeys && !knownFormKeys.has(action.inputSchemaRef)) {
        errors.push({ key: at, message: `inputSchemaRef '${action.inputSchemaRef}' is not a known form config` });
      }
    });

    for (const [status, target] of Object.entries<Rec>(isRecord(meta.reviewTargets) ? meta.reviewTargets : {})) {
      if (!statuses.has(status)) errors.push({ key: `reviewTargets.${status}`, message: 'Unknown status' });
      if (!target?.label || !target?.approvalType) {
        errors.push({ key: `reviewTargets.${status}`, message: 'reviewTargets entries need label and approvalType' });
      }
    }
  }

  // ───────────────────────────── value validation ─────────────────────────────

  /**
   * Applies submitted values onto the schema (echoed in `metaData`) and
   * validates them. `context` carries entity data used by `source: 'context'`
   * rules and context-keyed constraints.
   */
  validateAndApplyConfigMeta(
    metaData: Rec | undefined,
    values: Rec,
    context: Rec = {},
    options: ValidateOptions = {},
  ): ValidationResult {
    if (!isRecord(metaData)) return { ok: true, errors: [], metaData };

    const cloned = JSON.parse(JSON.stringify(metaData)) as Rec;
    const errors: ConfigValidationError[] = [];

    this.validateScope(cloned, values, '', context, options, errors);
    this.validateConstraints(cloned, values, context, errors);

    return { ok: errors.length === 0, errors, metaData: cloned };
  }

  private validateScope(
    container: Rec,
    scope: Rec,
    prefix: string,
    context: Rec,
    options: ValidateOptions,
    errors: ConfigValidationError[],
  ): void {
    this.collectScopeFields(container).forEach((field) =>
      this.validateValue(field, scope, prefix, context, options, errors),
    );
  }

  private validateValue(
    field: Rec,
    scope: Rec,
    prefix: string,
    context: Rec,
    options: ValidateOptions,
    errors: ConfigValidationError[],
  ): void {
    const key = typeof field.key === 'string' ? field.key : undefined;
    if (!key) return;
    const path = `${prefix}${key}`;
    const rule: ValidationRule = field.validation ?? {};
    const type = String(field.type ?? '');
    const value = scope[key];
    field.value = value ?? null;

    if (options.skipTransient && field.transient) return;
    if (field.visible_if && !evaluateRule(field.visible_if, scope, context)) return;

    if (!FIELD_TYPES.has(type)) {
      errors.push({ key: path, message: `Unsupported field type: ${type}` });
      return;
    }

    const required =
      field.required === true || rule.required === true || evaluateRule(field.required_if, scope, context);

    if (required && isEmptyValue(value)) {
      errors.push({ key: path, message: message(rule, 'required', 'This field is required') });
      return;
    }
    if (isEmptyValue(value)) {
      // An optional group row set may still be absent; nothing more to check.
      return;
    }

    if (type === ConfigInputType.GROUP) {
      this.validateGroup(field, value, path, rule, context, options, errors);
      return;
    }

    this.validateScalar(field, value, path, rule, type, errors);
  }

  private validateGroup(
    field: Rec,
    value: unknown,
    path: string,
    rule: ValidationRule,
    context: Rec,
    options: ValidateOptions,
    errors: ConfigValidationError[],
  ): void {
    if (field.repeatable) {
      if (!Array.isArray(value)) {
        errors.push({ key: path, message: 'Must be a list of items' });
        return;
      }
      if (rule.minCount !== undefined && value.length < rule.minCount) {
        errors.push({ key: path, message: message(rule, 'minCount', `Add at least ${rule.minCount} item(s)`) });
      }
      if (rule.maxCount !== undefined && value.length > rule.maxCount) {
        errors.push({ key: path, message: message(rule, 'maxCount', `Add no more than ${rule.maxCount} item(s)`) });
      }
      value.forEach((row, index) => {
        if (!isRecord(row)) {
          errors.push({ key: `${path}.${index}`, message: 'Each item must be an object' });
          return;
        }
        this.validateScope(field, row, `${path}.${index}.`, context, options, errors);
      });
      return;
    }

    if (!isRecord(value)) {
      errors.push({ key: path, message: 'Must be an object' });
      return;
    }
    this.validateScope(field, value, `${path}.`, context, options, errors);
  }

  private validateScalar(
    field: Rec,
    value: unknown,
    path: string,
    rule: ValidationRule,
    type: string,
    errors: ConfigValidationError[],
  ): void {
    const push = (code: string, fallback: string) =>
      errors.push({ key: path, message: message(rule, code, fallback) });

    if (typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) push('minLength', `Minimum length is ${rule.minLength}`);
      if (rule.maxLength !== undefined && value.length > rule.maxLength) push('maxLength', `Maximum length is ${rule.maxLength}`);
      if (rule.pattern && !new RegExp(rule.pattern).test(value)) push('pattern', 'Invalid format');
      if ((rule.email || type === ConfigInputType.EMAIL) && !EMAIL_REGEX.test(value)) push('email', 'Invalid email');
      if ((rule.phone || type === ConfigInputType.PHONE) && !PHONE_REGEX.test(value)) push('phone', 'Invalid phone number');
      if ((rule.url || type === ConfigInputType.URL) && !URL_REGEX.test(value)) push('url', 'Invalid URL');
    }

    const numericTypes: string[] = [ConfigInputType.NUMBER, ConfigInputType.MONEY];
    if (rule.numeric || rule.min !== undefined || rule.max !== undefined || numericTypes.includes(type)) {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(numeric)) push('numeric', 'Value must be numeric');
      else {
        if (rule.min !== undefined && numeric < rule.min) push('min', `Value must be at least ${rule.min}`);
        if (rule.max !== undefined && numeric > rule.max) push('max', `Value must be at most ${rule.max}`);
        if (rule.multipleOf && Math.abs(numeric / rule.multipleOf - Math.round(numeric / rule.multipleOf)) > 1e-9) {
          push('multipleOf', `Value must be a multiple of ${rule.multipleOf}`);
        }
      }
    }

    if (type === ConfigInputType.DATE || type === ConfigInputType.DATETIME || rule.minDate || rule.maxDate) {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) push('date', 'Invalid date');
      else {
        if (rule.minDate) {
          const min = rule.minDate === 'now' ? new Date() : new Date(rule.minDate);
          if (date < min) push('minDate', `Date must be after ${rule.minDate}`);
        }
        if (rule.maxDate && date > new Date(rule.maxDate)) push('maxDate', `Date must be before ${rule.maxDate}`);
      }
    }

    if (rule.allowedValues) {
      const items = Array.isArray(value) ? value : [value];
      if (items.some((item) => !rule.allowedValues!.map(text).includes(text(item)))) {
        push('allowedValues', 'Value not allowed');
      }
    }

    if (Array.isArray(value)) {
      if (rule.minCount !== undefined && value.length < rule.minCount) push('minCount', `Select at least ${rule.minCount} option(s)`);
      if (rule.maxCount !== undefined && value.length > rule.maxCount) push('maxCount', `Select no more than ${rule.maxCount} option(s)`);
    }

    if (type === ConfigInputType.FILE || rule.allowedFileTypes?.length) {
      const urls = fileUrls(value);
      if (urls.length === 0) push('fileUrl', 'File URL is required');
      else {
        if (rule.allowedFileTypes?.length && urls.some((url) => !hasExtension(url, rule.allowedFileTypes!))) {
          push('allowedFileTypes', 'Invalid file type');
        }
        const items = Array.isArray(value) ? value : [value];
        if (rule.maxFileSizeMb && items.some((i) => isRecord(i) && Number(i.sizeMb ?? i.size_mb) > rule.maxFileSizeMb!)) {
          push('maxFileSizeMb', 'File too large');
        }
      }
    }

    const choice = [ConfigInputType.SELECT, ConfigInputType.RADIO, ConfigInputType.MULTISELECT] as string[];
    if (choice.includes(type) && Array.isArray(field.options) && field.options.length > 0) {
      const allowed = optionValues(field.options);
      const items = Array.isArray(value) ? value : [value];
      if (items.some((item) => !allowed.has(text(item)))) {
        errors.push({ key: path, message: 'Selected value is not a valid option' });
      }
    }
  }

  // ───────────────────────────── cross-field constraints ─────────────────────────────

  private validateConstraints(meta: Rec, values: Rec, context: Rec, errors: ConfigValidationError[]): void {
    if (!Array.isArray(meta.constraints)) return;

    const resolve = (ref: unknown): number => {
      if (typeof ref === 'number') return ref;
      if (typeof ref !== 'string') return NaN;
      const raw = getPath(values, ref) ?? getPath(context, ref);
      return raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
    };
    const num = (ref: string): number => {
      const value = Number(getPath(values, ref));
      return Number.isNaN(value) ? 0 : value;
    };

    meta.constraints.forEach((constraint: Rec) => {
      const involved: string[] =
        constraint.type === 'sum'
          ? constraint.fields
          : constraint.type === 'lte'
            ? [constraint.field]
            : [constraint.collection];
      if (errors.some((e) => involved.some((key: string) => e.key === key || e.key.startsWith(`${key}.`)))) return;

      const fail = (fallback: string) =>
        errors.push({ key: involved[0] ?? '(constraint)', message: constraint.message ?? fallback });
      const tolerance = constraint.tolerance ?? 0.01;

      if (constraint.type === 'sum') {
        const target = constraint.value ?? resolve(constraint.equals ?? constraint.contextKey);
        if (Number.isNaN(target)) return;
        const total = constraint.fields.reduce((sum: number, ref: string) => sum + num(ref), 0);
        if (Math.abs(total - target) >= tolerance) fail(`The total must equal ${target}`);
      } else if (constraint.type === 'lte') {
        const actual = resolve(constraint.field);
        const max = resolve(constraint.max);
        if (!Number.isNaN(actual) && !Number.isNaN(max) && actual > max) fail(`Must not exceed ${max}`);
      } else if (constraint.type === 'sumRows') {
        const rows = getPath(values, constraint.collection);
        const target = resolve(constraint.equals ?? constraint.contextKey);
        if (!Array.isArray(rows) || Number.isNaN(target)) return;
        const total = rows.reduce(
          (sum: number, row: Rec) =>
            sum + (constraint.multiply as string[]).reduce((product, key) => product * (Number(row?.[key]) || 0), 1),
          0,
        );
        if (Math.abs(total - target) >= tolerance) fail(`The rows must add up to ${target}`);
      }
    });
  }
}
