import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

interface CachedResponse {
  body: unknown;
  expiresAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Replays the stored result of a mutation when the same `Idempotency-Key` is
 * sent again by the same user for the same route (API spec: mutations).
 * Held in process memory until the claims database exists; replace the Map
 * with a table/Redis key when persistence lands.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, CachedResponse>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      method: string;
      route?: { path?: string };
      originalUrl: string;
      headers: Record<string, string | undefined>;
      user?: { id: string };
    }>();

    const key = request.headers['idempotency-key'];
    if (!key || request.method === 'GET') return next.handle();

    const cacheKey = `${request.user?.id ?? 'anon'}|${request.method}|${request.originalUrl}|${key}`;
    this.evictExpired();

    const hit = this.cache.get(cacheKey);
    if (hit) {
      http.getResponse<{ setHeader: (n: string, v: string) => void }>().setHeader(
        'Idempotent-Replayed',
        'true',
      );
      return of(hit.body);
    }

    return next.handle().pipe(
      tap((body) => this.cache.set(cacheKey, { body, expiresAt: Date.now() + TTL_MS })),
    );
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache) {
      if (value.expiresAt < now) this.cache.delete(key);
    }
  }
}
