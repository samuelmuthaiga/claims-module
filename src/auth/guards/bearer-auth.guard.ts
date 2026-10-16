import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { ClaimsException, ErrorCode } from '../../common/exceptions/claims.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';
import { permissionsForRoles } from '../constants/permissions';
import { TokenService } from '../services/token.service';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Global guard: every route requires a valid Bearer token unless marked
 * @Public(). With DISABLE_AUTH=true (rejected by env validation in
 * staging/production) a configurable local user is injected so the UI team can
 * integrate before the platform gateway tokens are wired.
 */
@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly appConfig: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const app = this.appConfig.getConfig().app;

    if (app.disableAuth) {
      request.user = {
        id: app.disableAuthUserId,
        name: 'Local Dev User',
        email: 'dev.user@autochek.africa',
        country: 'NG',
        roles: app.disableAuthUserRoles,
        permissions: permissionsForRoles(app.disableAuthUserRoles),
      };
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const header = request.headers.authorization;
    const [scheme, token] = header?.split(' ') ?? [];
    if (!header || scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new ClaimsException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
        'Missing or malformed Authorization header',
      );
    }

    request.user = this.tokenService.verify(token);
    return true;
  }
}
