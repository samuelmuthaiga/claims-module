import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AppConfigService } from '../../config/app-config.service';
import { ClaimsException, ErrorCode } from '../../common/exceptions/claims.exception';
import { HttpStatus } from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface';
import { permissionsForRoles } from '../constants/permissions';

const toArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [];

@Injectable()
export class TokenService {
  constructor(private readonly appConfig: AppConfigService) {}

  verify(token: string): AuthUser {
    const { jwtSecret, jwtAlgorithm, jwtIssuer, jwtAudience } = this.appConfig.getConfig().auth;
    if (!jwtSecret) throw new UnauthorizedException('Auth configuration missing');

    let payload: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, jwtSecret, {
        algorithms: [jwtAlgorithm as jwt.Algorithm],
        ...(jwtIssuer ? { issuer: jwtIssuer } : {}),
        ...(jwtAudience ? { audience: jwtAudience } : {}),
      });
      if (typeof verified === 'string') throw new Error('Unexpected token payload');
      payload = verified;
    } catch (error) {
      const expired = error instanceof jwt.TokenExpiredError;
      throw new ClaimsException(
        HttpStatus.UNAUTHORIZED,
        expired ? ErrorCode.TOKEN_EXPIRED : ErrorCode.TOKEN_INVALID,
        expired ? 'Token has expired' : 'Invalid token',
      );
    }

    const id = (payload.userId ?? payload.sub) as string | undefined;
    if (!id) {
      throw new ClaimsException(HttpStatus.UNAUTHORIZED, ErrorCode.TOKEN_INVALID, 'Invalid token payload');
    }

    const roles = [...toArray(payload.roles), ...toArray(payload.role)];
    return {
      id,
      name: payload.name as string | undefined,
      email: (payload.email as string | undefined) ?? undefined,
      country: payload.country as string | undefined,
      roles,
      permissions: permissionsForRoles(roles, toArray(payload.permissions)),
    };
  }

  sign(user: AuthUser, ttlSeconds: number, type: 'access' | 'refresh' = 'access'): string {
    const { jwtSecret, jwtAlgorithm, jwtIssuer, jwtAudience } = this.appConfig.getConfig().auth;
    return jwt.sign(
      {
        sub: user.id,
        name: user.name,
        email: user.email,
        country: user.country,
        roles: user.roles,
        typ: type,
      },
      jwtSecret,
      {
        algorithm: jwtAlgorithm as jwt.Algorithm,
        expiresIn: ttlSeconds,
        ...(jwtIssuer ? { issuer: jwtIssuer } : {}),
        ...(jwtAudience ? { audience: jwtAudience } : {}),
      },
    );
  }
}
