import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ClaimsException } from '../exceptions/claims.exception';
import { FieldError } from '../interfaces/error-response.interface';

const flatten = (errors: ValidationError[], parent = ''): FieldError[] =>
  errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      key: path,
      message,
    }));
    return [...own, ...flatten(error.children ?? [], path)];
  });

/**
 * Global DTO validation: strips unknown properties, rejects unexpected ones,
 * and reports failures as `422 VALIDATION_FAILED` with field-keyed errors —
 * the same `{ key, message }` shape the config submit endpoint returns, so the
 * UI maps both onto form fields the same way.
 */
export const createValidationPipe = (): ValidationPipe =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => ClaimsException.validation(flatten(errors)),
  });
