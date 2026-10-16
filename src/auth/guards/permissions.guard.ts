import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClaimsException, ErrorCode } from '../../common/exceptions/claims.exception';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedRequest } from './bearer-auth.guard';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    const missing = required.filter((permission) => !user?.permissions.includes(permission));
    if (missing.length) {
      throw ClaimsException.forbidden(
        ErrorCode.FORBIDDEN,
        `Missing permission: ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
