import { HttpException, HttpStatus } from '@nestjs/common';
import { FieldError } from '../interfaces/error-response.interface';

/** Error codes from the Claims API specification (section 10). */
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  FORBIDDEN = 'FORBIDDEN',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  DUPLICATE_OPEN_CLAIM = 'DUPLICATE_OPEN_CLAIM',
  CAR_NOT_ELIGIBLE = 'CAR_NOT_ELIGIBLE',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  VERSION_CONFLICT = 'VERSION_CONFLICT',
  MAKER_CHECKER_VIOLATION = 'MAKER_CHECKER_VIOLATION',
  READY_BLOCKED_BY_QA = 'READY_BLOCKED_BY_QA',
  WARRANTY_CAP_EXCEEDED = 'WARRANTY_CAP_EXCEEDED',
  QUOTE_TOTAL_MISMATCH = 'QUOTE_TOTAL_MISMATCH',
  QUOTE_UPFRONT_EXCEEDS_TOTAL = 'QUOTE_UPFRONT_EXCEEDS_TOTAL',
  DUPLICATE_INVOICE = 'DUPLICATE_INVOICE',
  PAYMENT_SPLIT_MISMATCH = 'PAYMENT_SPLIT_MISMATCH',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  DOCUMENT_REQUIRED = 'DOCUMENT_REQUIRED',
  SCHEDULE_LINK_INVALID = 'SCHEDULE_LINK_INVALID',
  SCHEDULE_LINK_EXPIRED = 'SCHEDULE_LINK_EXPIRED',
  SCHEDULE_LINK_USED = 'SCHEDULE_LINK_USED',
  VENDOR_NOT_ELIGIBLE = 'VENDOR_NOT_ELIGIBLE',
  APPOINTMENT_OUT_OF_WINDOW = 'APPOINTMENT_OUT_OF_WINDOW',
  RATE_LIMITED = 'RATE_LIMITED',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class ClaimsException extends HttpException {
  constructor(
    status: HttpStatus,
    errorCode: ErrorCode,
    message: string,
    extra: { errors?: FieldError[]; details?: unknown } = {},
  ) {
    super({ errorCode, message, ...extra }, status);
  }

  static validation(errors: FieldError[], message = 'Request validation failed') {
    return new ClaimsException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCode.VALIDATION_FAILED,
      message,
      { errors },
    );
  }

  static notFound(what: string, id?: string | number) {
    return new ClaimsException(
      HttpStatus.NOT_FOUND,
      ErrorCode.RESOURCE_NOT_FOUND,
      id === undefined ? `${what} not found` : `${what} '${id}' not found`,
    );
  }

  static invalidTransition(message: string) {
    return new ClaimsException(
      HttpStatus.CONFLICT,
      ErrorCode.INVALID_TRANSITION,
      message,
    );
  }

  static versionConflict(expected: number, actual: number) {
    return new ClaimsException(
      HttpStatus.PRECONDITION_FAILED,
      ErrorCode.VERSION_CONFLICT,
      `Version conflict: expected ${expected}, current is ${actual}`,
      { details: { expected, actual } },
    );
  }

  static unprocessable(code: ErrorCode, message: string, details?: unknown) {
    return new ClaimsException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, {
      details,
    });
  }

  static conflict(code: ErrorCode, message: string) {
    return new ClaimsException(HttpStatus.CONFLICT, code, message);
  }

  static forbidden(code: ErrorCode, message: string) {
    return new ClaimsException(HttpStatus.FORBIDDEN, code, message);
  }
}
