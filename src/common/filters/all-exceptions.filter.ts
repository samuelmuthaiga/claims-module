import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../exceptions/claims.exception';
import { ErrorResponse } from '../interfaces/error-response.interface';
import { RequestWithId } from '../middlewares/request-id.middleware';

interface HttpExceptionBody {
  message?: string | string[];
  error?: string;
  errorCode?: string;
  errors?: ErrorResponse['errors'];
  details?: unknown;
}

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.RESOURCE_NOT_FOUND,
  409: ErrorCode.INVALID_TRANSITION,
  412: ErrorCode.VERSION_CONFLICT,
  422: ErrorCode.VALIDATION_FAILED,
  429: ErrorCode.RATE_LIMITED,
  501: ErrorCode.NOT_IMPLEMENTED,
  502: ErrorCode.UPSTREAM_ERROR,
  503: ErrorCode.UPSTREAM_ERROR,
  504: ErrorCode.UPSTREAM_ERROR,
};

const joinMessage = (message: string | string[] | undefined): string =>
  Array.isArray(message) ? message.join(', ') : (message ?? 'Request failed');

/**
 * Single place that shapes every error response:
 * `{ success: false, statusCode, errorCode, message, errors?, requestId, path }`.
 * Unknown exceptions are logged and returned as an opaque 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly includeStack = false) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId & Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const body: HttpExceptionBody = typeof raw === 'string' ? { message: raw } : (raw as HttpExceptionBody);

      const payload: ErrorResponse = {
        success: false,
        statusCode: status,
        error: exception.name,
        errorCode: body.errorCode ?? STATUS_TO_CODE[status] ?? ErrorCode.INTERNAL_ERROR,
        message: joinMessage(body.message),
        ...(body.errors ? { errors: body.errors } : {}),
        ...(body.details !== undefined ? { details: body.details } : {}),
        requestId: request.requestId,
        path: request.originalUrl,
        timestamp: new Date().toISOString(),
      };

      response.status(status).json(payload);
      return;
    }

    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(
      `${request.method} ${request.originalUrl} [${request.requestId}] ${error.message}`,
      this.includeStack ? error.stack : undefined,
    );

    const payload: ErrorResponse = {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      errorCode: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      requestId: request.requestId,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }
}
