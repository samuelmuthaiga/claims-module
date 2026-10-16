import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

type EnvelopePayload = Record<string, unknown> & {
  data?: unknown;
  message?: unknown;
  meta?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]';

const normalizeUndefined = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(normalizeUndefined);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, normalizeUndefined(val)]),
    );
  }
  return value;
};

/**
 * Wraps every successful response in the Autochek envelope
 * `{ success, statusCode, data, meta?, message?, timestamp }`.
 *
 * Controllers return the payload directly; list endpoints return
 * `{ data, meta }` and single-resource endpoints may add a `message`.
 * `data` and `meta.{total,page,limit}` match the Claims UI contract, so the
 * UI keeps reading `res.data` / `res.meta` unchanged.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      map((data) => {
        let payload: unknown = data;
        let message: string | undefined;
        let meta: ApiResponse<T>['meta'];

        // `{ data, meta?, message? }` is unwrapped; anything else is the payload itself.
        const isEnvelope =
          isRecord(data) &&
          'data' in data &&
          Object.keys(data).every((key) => key === 'data' || key === 'meta' || key === 'message');
        if (isEnvelope) {
          const envelope = data as EnvelopePayload;
          payload = envelope.data;
          if (typeof envelope.message === 'string') message = envelope.message;
          if (isRecord(envelope.meta)) {
            meta = envelope.meta as ApiResponse<T>['meta'];
          }
        }

        const wrapped: ApiResponse<T> = {
          success: true,
          statusCode: response.statusCode,
          data: payload as T,
          timestamp: new Date().toISOString(),
          ...(message ? { message } : {}),
          ...(meta ? { meta } : {}),
        };

        return normalizeUndefined(wrapped) as ApiResponse<T>;
      }),
    );
  }
}
