import { Injectable } from '@nestjs/common';
import { ConfigInputType } from '../enums/config-input-type.enum';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ConfigValuePayload {
  [key: string]: unknown;
}

export interface ConfigValidationError {
  key: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ConfigValidationError[];
  metaData: Record<string, unknown> | undefined;
}

export interface SchemaValidationResult {
  ok: boolean;
  errors: ConfigValidationError[];
}

type ValidationRule = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  allowedValues?: JsonValue[];
  minDate?: string;
  maxDate?: string;
  minCount?: number;
  maxCount?: number;
  minFiles?: number;
  maxFiles?: number;
  maxFileSizeMb?: number;
  allowedFileTypes?: string[];
  email?: boolean;
  phone?: boolean;
  url?: boolean;
  numeric?: boolean;
  messages?: Record<string, string>;
};

/**
 * Conditional rule shared by `required_if` and `visible_if`. The rule only
 * applies once the referenced field has been answered — same semantics as the
 * Fleetzen UI's fieldRules.ts.
 *
 *   "required_if": { "field": "claimType", "equals": "WARRANTY" }
 *
 * Supported conditions: equals, not_equals, in (array), not_in (array).
 */
export type ConditionalRule = {
  field?: string;
  equals?: unknown;
  not_equals?: unknown;
  in?: unknown[];
  not_in?: unknown[];
};

/**
 * Cross-field constraint evaluated after per-field validation. Currently the
 * only type is `sum`, which requires the numeric sum of `fields` to equal a
 * target — either a literal `value` or a key resolved from the request
 * context (e.g. a claim's quoteTotal for the payment split form).
 */
export type FieldConstraint = {
  type: 'sum';
  fields: string[];
  value?: number;
  contextKey?: string;
  tolerance?: number;
  message?: string;
};

export type FieldDefinition = {
  key?: string;
  type?: string;
  label?: string;
  required?: boolean;
  required_if?: ConditionalRule;
  visible_if?: ConditionalRule;
  value?: JsonValue;
  options?: JsonValue[];
  options_source?: unknown;
  validation?: ValidationRule;
  fields?: FieldDefinition[];
  sections?: FieldDefinition[];
  multiple?: boolean;
  hidden?: boolean;
  [key: string]: unknown;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d][\d\s\-()]+$/;
const URL_REGEX = /^https?:\/\/\S+$/;
const ALLOWED_FIELD_TYPES = new Set(Object.values(ConfigInputType));

function asText(value: unknown): string {
  return String(value ?? '');
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    const allEmpty = value.every((item) => {
      if (item === null || item === undefined) return true;
      if (typeof item === 'string') return item.trim() === '';
      if (typeof item === 'object' && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        if (Object.keys(obj).length === 0) return true;
        if ('url' in obj) {
          const url = obj.url;
          return typeof url !== 'string' || url.trim() === '';
        }
      }
      return false;
    });
    if (allEmpty) return true;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 0) return true;
    if ('url' in obj) {
      const url = obj.url;
      if (typeof url !== 'string' || url.trim() === '') return true;
    }
  }
  return false;
}

/** True when the conditional rule is satisfied by the current form values. */
export function evaluateConditionalRule(
  rule: ConditionalRule | undefined,
  values: Record<string, unknown> | null | undefined,
): boolean {
  if (!rule?.field) return false;
  const other = values?.[rule.field];
  if (isEmptyValue(other)) return false;

  const answer = asText(other);
  if (rule.equals !== undefined) return answer === asText(rule.equals);
  if (rule.not_equals !== undefined) return answer !== asText(rule.not_equals);
  if (Array.isArray(rule.in)) return rule.in.map(asText).includes(answer);
  if (Array.isArray(rule.not_in))
    return !rule.not_in.map(asText).includes(answer);
  return false;
}

function messageFor(
  validation: ValidationRule,
  key: string,
  fallback: string,
): string {
  return validation.messages?.[key] || fallback;
}

function hasAllowedExtension(value: string, allowed: string[]): boolean {
  const lower = value.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext.toLowerCase()));
}

function isAllowedValue(
  value: unknown,
  allowed: JsonValue[],
  numeric: boolean,
): boolean {
  if (!numeric) {
    return allowed.includes(value as JsonValue);
  }
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numericValue)) return false;
  return allowed.some((item) => {
    const allowedNumeric = typeof item === 'number' ? item : Number(item);
    if (!Number.isNaN(allowedNumeric)) {
      return allowedNumeric === numericValue;
    }
    return item === value;
  });
}

function hasFileUrl(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    return value.every((item) => {
      if (typeof item === 'string') return item.trim().length > 0;
      if (item && typeof item === 'object' && 'url' in item) {
        const url = (item as Record<string, unknown>).url;
        return typeof url === 'string' && url.trim().length > 0;
      }
      return false;
    });
  }
  if (typeof value === 'object' && 'url' in (value as Record<string, unknown>)) {
    const url = (value as Record<string, unknown>).url;
    return typeof url === 'string' && url.trim().length > 0;
  }
  return false;
}

function extractAllowedOptionValues(options: JsonValue[]): Set<string> {
  const allowed = new Set<string>();
  if (!Array.isArray(options)) return allowed;
  options.forEach((opt) => {
    let val: unknown = opt;
    if (opt && typeof opt === 'object' && 'value' in opt) {
      val = (opt as Record<string, unknown>).value;
    }
    if (val !== null && val !== undefined) {
      allowed.add(String(val));
    }
  });
  return allowed;
}

function isOptionMatch(value: unknown, allowed: Set<string>): boolean {
  if (value === null || value === undefined) return false;
  return allowed.has(String(value));
}

function hasUsableOptionsSource(
  optionsSource: unknown,
  key: string,
  errors: ConfigValidationError[],
): boolean {
  if (optionsSource === undefined || optionsSource === null) return false;
  if (typeof optionsSource === 'string') {
    return optionsSource.trim().length > 0;
  }
  if (typeof optionsSource !== 'object' || Array.isArray(optionsSource)) {
    errors.push({
      key: key || '(unknown)',
      message: 'options_source must be a string or object',
    });
    return false;
  }

  const source = optionsSource as Record<string, unknown>;
  const rawUrl = typeof source.url === 'string' ? source.url.trim() : '';
  const rawFullUrl =
    typeof source.fullUrl === 'string' ? source.fullUrl.trim() : '';
  const hasUrl = rawUrl.length > 0;
  const hasFullUrl = rawFullUrl.length > 0;

  if (!hasUrl && !hasFullUrl) {
    errors.push({
      key: key || '(unknown)',
      message: 'options_source must provide at least one of url or fullUrl',
    });
    return false;
  }

  if (hasUrl && !rawUrl.startsWith('/')) {
    errors.push({
      key: key || '(unknown)',
      message: 'options_source.url must start with /',
    });
  }
  if (hasFullUrl && !URL_REGEX.test(rawFullUrl)) {
    errors.push({
      key: key || '(unknown)',
      message: 'options_source.fullUrl must be absolute http/https URL',
    });
  }

  return true;
}

/**
 * Validates config meta_data schemas and applies/validates submitted form
 * values against them. Ported from micro-fleetzen-service's
 * ConfigMetadataValidator with claims extensions: `required_if`/`visible_if`
 * are evaluated server-side and `metaData.constraints` adds cross-field rules.
 */
@Injectable()
export class ConfigMetadataValidator {
  /** Validates the config meta_data schema itself (keys/labels/types/options). */
  validateConfigSchema(
    metaData: Record<string, unknown> | undefined,
  ): SchemaValidationResult {
    if (!metaData || typeof metaData !== 'object') {
      return { ok: true, errors: [] };
    }

    const errors: ConfigValidationError[] = [];
    const seenKeys = new Set<string>();

    const validateFieldShape = (field: FieldDefinition): void => {
      if (!field || typeof field !== 'object') return;

      const key = typeof field.key === 'string' ? field.key.trim() : '';
      const label =
        typeof field.label === 'string' ? field.label.trim() : '';
      const type = typeof field.type === 'string' ? field.type : undefined;

      if (!key) {
        errors.push({ key: '(unknown)', message: 'Field key is required' });
      } else if (seenKeys.has(key)) {
        errors.push({ key, message: 'Duplicate field key found in schema' });
      } else {
        seenKeys.add(key);
      }

      if (!label) {
        errors.push({
          key: key || '(unknown)',
          message: 'Field label is required',
        });
      }
      if (!type) {
        errors.push({
          key: key || '(unknown)',
          message: 'Field type is required',
        });
        return;
      }
      if (!ALLOWED_FIELD_TYPES.has(type as ConfigInputType)) {
        errors.push({
          key: key || '(unknown)',
          message: `Unsupported field type: ${type}`,
        });
        return;
      }

      const needsOptions =
        type === ConfigInputType.SELECT ||
        type === ConfigInputType.MULTISELECT ||
        type === ConfigInputType.RADIO;
      if (needsOptions) {
        const hasOptions =
          Array.isArray(field.options) && field.options.length > 0;
        const hasOptionsSource = hasUsableOptionsSource(
          field.options_source,
          key,
          errors,
        );
        if (!hasOptions && !hasOptionsSource) {
          errors.push({
            key: key || '(unknown)',
            message:
              'options or options_source is required for select/radio fields',
          });
        }

        if (Array.isArray(field.options) && field.options.length > 0) {
          const seenValues = new Set<string>();
          field.options.forEach((opt, idx) => {
            let value: unknown = opt;
            let optLabel: unknown = undefined;
            if (opt && typeof opt === 'object' && !Array.isArray(opt)) {
              const rec = opt as Record<string, unknown>;
              optLabel = rec.label;
              value = rec.value;
            }

            const valueStr =
              value === null || value === undefined
                ? ''
                : String(value).trim();
            if (!valueStr) {
              errors.push({
                key: key || '(unknown)',
                message: `options[${idx}] must have a non-empty value`,
              });
              return;
            }

            if (seenValues.has(valueStr)) {
              errors.push({
                key: key || '(unknown)',
                message: `Duplicate option value '${valueStr}' found in options[]`,
              });
            } else {
              seenValues.add(valueStr);
            }

            if (optLabel !== undefined) {
              const labelStr =
                typeof optLabel === 'string'
                  ? optLabel.trim()
                  : String(optLabel ?? '').trim();
              if (!labelStr) {
                errors.push({
                  key: key || '(unknown)',
                  message: `options[${idx}] must have a non-empty label`,
                });
              }
            }
          });
        }
      }

      if (Array.isArray(field.fields)) {
        field.fields.forEach((child) => validateFieldShape(child));
      }
      if (Array.isArray(field.sections)) {
        field.sections.forEach((section) => {
          if (
            section &&
            typeof section === 'object' &&
            Array.isArray(section.fields)
          ) {
            section.fields.forEach((child) => validateFieldShape(child));
          } else {
            errors.push({
              key: key || '(unknown)',
              message: 'sections entries must include fields[]',
            });
          }
        });
      }
    };

    const walk = (node: FieldDefinition): void => {
      if (!node || typeof node !== 'object') return;

      const hasFields = Array.isArray(node.fields) && node.fields.length > 0;
      const hasSections =
        Array.isArray(node.sections) && node.sections.length > 0;
      if (!hasFields && !hasSections) {
        errors.push({
          key: '(root)',
          message: 'meta_data must include sections[] or fields[]',
        });
      }

      if (Array.isArray(node.fields)) {
        node.fields.forEach((field) => validateFieldShape(field));
      }
      if (Array.isArray(node.sections)) {
        node.sections.forEach((section) => {
          if (
            section &&
            typeof section === 'object' &&
            Array.isArray(section.fields)
          ) {
            section.fields.forEach((field) => validateFieldShape(field));
          }
        });
      }
    };

    walk(metaData as FieldDefinition);

    return { ok: errors.length === 0, errors };
  }

  /**
   * Applies submitted values onto the schema and validates field rules.
   * `context` carries entity data (e.g. a claim) used by `required_if`,
   * `visible_if` and `metaData.constraints` targets.
   */
  validateAndApplyConfigMeta(
    metaData: Record<string, unknown> | undefined,
    values: ConfigValuePayload,
    context: Record<string, unknown> = {},
  ): ValidationResult {
    if (!metaData || typeof metaData !== 'object') {
      return { ok: true, errors: [], metaData };
    }

    const cloned = JSON.parse(JSON.stringify(metaData)) as Record<
      string,
      unknown
    >;
    const errors: ConfigValidationError[] = [];

    const applyToField = (field: FieldDefinition): void => {
      if (!field || typeof field !== 'object') return;

      const key = typeof field.key === 'string' ? field.key : undefined;
      const validation = field.validation ?? {};
      const type = typeof field.type === 'string' ? field.type : undefined;

      if (key) {
        field.value = (values[key] ?? null) as JsonValue;
      }
      if (!key) return;

      if (type && !ALLOWED_FIELD_TYPES.has(type as ConfigInputType)) {
        errors.push({ key, message: `Unsupported field type: ${type}` });
        return;
      }

      // A field hidden by visible_if collects no value — skip it entirely.
      if (
        field.visible_if &&
        !evaluateConditionalRule(field.visible_if, values)
      ) {
        return;
      }

      const required =
        field.required === true ||
        validation.required === true ||
        evaluateConditionalRule(field.required_if, values);
      const value = values[key];

      if (required && isEmptyValue(value)) {
        errors.push({
          key,
          message: messageFor(validation, 'required', 'This field is required'),
        });
        return;
      }

      if (isEmptyValue(value)) {
        return;
      }

      if (
        validation.minLength !== undefined &&
        typeof value === 'string' &&
        value.length < validation.minLength
      ) {
        errors.push({
          key,
          message: messageFor(
            validation,
            'minLength',
            `Minimum length is ${validation.minLength}`,
          ),
        });
      }

      if (
        validation.maxLength !== undefined &&
        typeof value === 'string' &&
        value.length > validation.maxLength
      ) {
        errors.push({
          key,
          message: messageFor(
            validation,
            'maxLength',
            `Maximum length is ${validation.maxLength}`,
          ),
        });
      }

      if (validation.pattern && typeof value === 'string') {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          errors.push({
            key,
            message: messageFor(validation, 'pattern', 'Invalid format'),
          });
        }
      }

      if (validation.numeric) {
        const numericValue =
          typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(numericValue)) {
          errors.push({
            key,
            message: messageFor(validation, 'numeric', 'Value must be numeric'),
          });
        }
      }

      if (validation.min !== undefined || validation.max !== undefined) {
        const numericValue =
          typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(numericValue)) {
          errors.push({
            key,
            message: messageFor(validation, 'numeric', 'Value must be numeric'),
          });
        } else {
          if (
            validation.min !== undefined &&
            numericValue < validation.min
          ) {
            errors.push({
              key,
              message: messageFor(
                validation,
                'min',
                `Value must be at least ${validation.min}`,
              ),
            });
          }
          if (
            validation.max !== undefined &&
            numericValue > validation.max
          ) {
            errors.push({
              key,
              message: messageFor(
                validation,
                'max',
                `Value must be at most ${validation.max}`,
              ),
            });
          }
        }
      }

      if (validation.allowedValues) {
        const allowed = validation.allowedValues;
        if (Array.isArray(value)) {
          const invalid = value.some(
            (item) =>
              !isAllowedValue(item, allowed, validation.numeric === true),
          );
          if (invalid) {
            errors.push({
              key,
              message: messageFor(
                validation,
                'allowedValues',
                'Value not allowed',
              ),
            });
          }
        } else if (
          !isAllowedValue(value, allowed, validation.numeric === true)
        ) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'allowedValues',
              'Value not allowed',
            ),
          });
        }
      }

      if (
        validation.email &&
        typeof value === 'string' &&
        !EMAIL_REGEX.test(value)
      ) {
        errors.push({
          key,
          message: messageFor(validation, 'email', 'Invalid email'),
        });
      }

      if (
        validation.phone &&
        typeof value === 'string' &&
        !PHONE_REGEX.test(value)
      ) {
        errors.push({
          key,
          message: messageFor(validation, 'phone', 'Invalid phone number'),
        });
      }

      if (validation.url && typeof value === 'string' && !URL_REGEX.test(value)) {
        errors.push({
          key,
          message: messageFor(validation, 'url', 'Invalid URL'),
        });
      }

      if (validation.minDate || validation.maxDate) {
        const dateValue = new Date(String(value));
        if (Number.isNaN(dateValue.getTime())) {
          errors.push({
            key,
            message: messageFor(validation, 'date', 'Invalid date'),
          });
        } else {
          if (validation.minDate) {
            const minDate =
              validation.minDate === 'now'
                ? new Date()
                : new Date(validation.minDate);
            if (dateValue < minDate) {
              errors.push({
                key,
                message: messageFor(
                  validation,
                  'minDate',
                  `Date must be after ${validation.minDate}`,
                ),
              });
            }
          }
          if (validation.maxDate && dateValue > new Date(validation.maxDate)) {
            errors.push({
              key,
              message: messageFor(
                validation,
                'maxDate',
                `Date must be before ${validation.maxDate}`,
              ),
            });
          }
        }
      }

      if (Array.isArray(value)) {
        if (
          validation.minCount !== undefined &&
          value.length < validation.minCount
        ) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'minCount',
              `Select at least ${validation.minCount} option(s)`,
            ),
          });
        }
        if (
          validation.maxCount !== undefined &&
          value.length > validation.maxCount
        ) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'maxCount',
              `Select no more than ${validation.maxCount} option(s)`,
            ),
          });
        }
        if (
          validation.minFiles !== undefined &&
          value.length < validation.minFiles
        ) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'minFiles',
              `Upload at least ${validation.minFiles} file(s)`,
            ),
          });
        }
        if (
          validation.maxFiles !== undefined &&
          value.length > validation.maxFiles
        ) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'maxFiles',
              `Upload no more than ${validation.maxFiles} file(s)`,
            ),
          });
        }
      }

      const requiresFileUrl =
        type === ConfigInputType.FILE ||
        (validation.allowedFileTypes &&
          validation.allowedFileTypes.length > 0);

      if (requiresFileUrl && !hasFileUrl(value)) {
        errors.push({
          key,
          message: messageFor(validation, 'fileUrl', 'File URL is required'),
        });
      }

      if (validation.allowedFileTypes && typeof value === 'string') {
        if (!hasAllowedExtension(value, validation.allowedFileTypes)) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'allowedFileTypes',
              'Invalid file type',
            ),
          });
        }
      }

      if (validation.allowedFileTypes && Array.isArray(value)) {
        const invalid = value.some((item) => {
          if (typeof item === 'string')
            return !hasAllowedExtension(item, validation.allowedFileTypes!);
          if (item && typeof item === 'object' && 'url' in item) {
            const url = (item as Record<string, unknown>).url;
            return (
              typeof url === 'string' &&
              !hasAllowedExtension(url, validation.allowedFileTypes!)
            );
          }
          return false;
        });
        if (invalid) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'allowedFileTypes',
              'Invalid file type',
            ),
          });
        }
      }

      if (
        validation.allowedFileTypes &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        const url = (value as Record<string, unknown>).url;
        if (
          typeof url === 'string' &&
          !hasAllowedExtension(url, validation.allowedFileTypes)
        ) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'allowedFileTypes',
              'Invalid file type',
            ),
          });
        }
      }

      // Strict select/radio option validation.
      if (
        (type === ConfigInputType.SELECT ||
          type === ConfigInputType.RADIO ||
          type === ConfigInputType.MULTISELECT) &&
        Array.isArray(field.options) &&
        field.options.length > 0
      ) {
        const allowedOptions = extractAllowedOptionValues(field.options);
        if (type === ConfigInputType.MULTISELECT && Array.isArray(value)) {
          const invalid = value.some((v) => !isOptionMatch(v, allowedOptions));
          if (invalid) {
            errors.push({
              key,
              message: 'Selected value is not a valid option',
            });
          }
        } else if (!isEmptyValue(value) && !Array.isArray(value)) {
          if (!isOptionMatch(value, allowedOptions)) {
            errors.push({
              key,
              message: 'Selected value is not a valid option',
            });
          }
        }
      }

      if (validation.maxFileSizeMb && Array.isArray(value)) {
        const tooLarge = value.some((item) => {
          if (item && typeof item === 'object') {
            const sizeMb =
              (item as Record<string, unknown>).sizeMb ??
              (item as Record<string, unknown>).size_mb;
            return (
              typeof sizeMb === 'number' && sizeMb > validation.maxFileSizeMb!
            );
          }
          return false;
        });
        if (tooLarge) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'maxFileSizeMb',
              'File too large',
            ),
          });
        }
      }

      if (
        validation.maxFileSizeMb &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        const sizeMb =
          (value as Record<string, unknown>).sizeMb ??
          (value as Record<string, unknown>).size_mb;
        if (typeof sizeMb === 'number' && sizeMb > validation.maxFileSizeMb) {
          errors.push({
            key,
            message: messageFor(
              validation,
              'maxFileSizeMb',
              'File too large',
            ),
          });
        }
      }
    };

    const walk = (node: FieldDefinition): void => {
      if (!node || typeof node !== 'object') return;

      if (Array.isArray(node.fields)) {
        node.fields.forEach((field) => applyToField(field));
        node.fields.forEach((field) => walk(field));
      }
      if (Array.isArray(node.sections)) {
        node.sections.forEach((section) => walk(section));
      }
    };

    walk(cloned as FieldDefinition);

    this.validateConstraints(cloned, values, context, errors);

    return { ok: errors.length === 0, errors, metaData: cloned };
  }

  /**
   * Cross-field constraints from metaData.constraints[]. `sum` requires the
   * numeric sum of the listed fields to equal `value`, or a number resolved
   * from `contextKey` (request context first, then submitted values).
   */
  private validateConstraints(
    metaData: Record<string, unknown>,
    values: ConfigValuePayload,
    context: Record<string, unknown>,
    errors: ConfigValidationError[],
  ): void {
    const constraints = (metaData as Record<string, unknown>)
      .constraints as FieldConstraint[] | undefined;
    if (!Array.isArray(constraints)) return;

    constraints.forEach((constraint) => {
      if (constraint?.type !== 'sum' || !Array.isArray(constraint.fields)) {
        return;
      }

      const sum = constraint.fields.reduce((total, fieldKey) => {
        const raw = values[fieldKey];
        const num = typeof raw === 'number' ? raw : Number(raw);
        return total + (Number.isNaN(num) ? 0 : num);
      }, 0);

      const target =
        constraint.value ??
        (constraint.contextKey
          ? Number(
              context[constraint.contextKey] ?? values[constraint.contextKey],
            )
          : NaN);

      if (Number.isNaN(target)) return;

      const tolerance = constraint.tolerance ?? 0.01;
      if (Math.abs(sum - target) >= tolerance) {
        errors.push({
          key: constraint.fields[0] ?? '(constraint)',
          message:
            constraint.message ??
            `The total of ${constraint.fields.join(', ')} must equal ${target}`,
        });
      }
    });
  }
}
