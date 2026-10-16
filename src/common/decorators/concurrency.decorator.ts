import { applyDecorators, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

/** Documents the optional mutation headers from the API spec. */
export const ApiMutationHeaders = (): MethodDecorator =>
  applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Replays the stored response when the same key is sent again (24h).',
    }),
    ApiHeader({
      name: 'If-Match',
      required: false,
      description: 'Expected resource version; stale versions fail with 412 VERSION_CONFLICT.',
    }),
  );

/** Parses the `If-Match` header into a version number (quotes/`W/` prefix tolerated). */
export const IfMatchVersion = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number | undefined => {
    const header = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>()
      .headers['if-match'];
    if (!header) return undefined;
    const parsed = parseInt(header.replace(/^W\//, '').replace(/"/g, ''), 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  },
);
