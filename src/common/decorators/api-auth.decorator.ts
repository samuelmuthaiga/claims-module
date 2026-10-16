import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiErrorResponse } from './api-response.decorator';

/**
 * Swagger-only marker: authentication itself is enforced by the global
 * BearerAuthGuard (secure by default; opt out with @Public()).
 */
export const ApiAuth = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiBearerAuth('BearerAuth'),
    ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing or invalid token'),
    ApiErrorResponse(HttpStatus.FORBIDDEN, 'Insufficient permissions'),
  );
