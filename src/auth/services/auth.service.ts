import { Injectable } from '@nestjs/common';
import { ClaimsException, ErrorCode } from '../../common/exceptions/claims.exception';
import { HttpStatus } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { ConfigsService } from '../../modules/configs/services/configs.service';
import { permissionsForRoles, primaryRole } from '../constants/permissions';
import { SsoLoginDto } from '../dto/auth.dto';
import { AuthUser } from '../interfaces/auth-user.interface';
import { TokenService } from './token.service';

const DEPLOYED_ENVS = ['production', 'prod', 'staging'];

@Injectable()
export class AuthService {
  constructor(
    private readonly tokens: TokenService,
    private readonly appConfig: AppConfigService,
    private readonly configs: ConfigsService,
  ) {}

  profile(user: AuthUser) {
    const settings = this.configs.getSettings();
    return {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: primaryRole(user.roles),
      roles: user.roles,
      country: user.country ?? null,
      permissions: user.permissions,
      featureFlags: {
        qaAdminSignoff: settings.featureFlags.qaAdminSignoff,
        dualApprovalThreshold: settings.dualApprovalThreshold,
      },
      // Changes whenever any UI config changes; compare against the bootstrap etag to refresh the cache.
      configEtag: this.configs.getEtag(),
    };
  }

  /**
   * SSO exchange. The identity provider is not integrated yet, so outside
   * deployed environments this issues a real, verifiable token for the local
   * dev user; in staging/production it refuses rather than faking a login.
   */
  ssoLogin(_dto: SsoLoginDto) {
    const { env, disableAuthUserId, disableAuthUserRoles } = this.appConfig.getConfig().app;
    const { jwtSecret, accessTokenTtlSeconds } = this.appConfig.getConfig().auth;

    if (DEPLOYED_ENVS.includes(env) || !jwtSecret) {
      throw new ClaimsException(
        HttpStatus.NOT_IMPLEMENTED,
        ErrorCode.NOT_IMPLEMENTED,
        'SSO login is not available yet; authenticate with the platform gateway token',
      );
    }

    const user: AuthUser = {
      id: disableAuthUserId,
      name: 'Local Dev User',
      email: 'dev.user@autochek.africa',
      country: 'NG',
      roles: disableAuthUserRoles,
      permissions: permissionsForRoles(disableAuthUserRoles),
    };
    return {
      accessToken: this.tokens.sign(user, accessTokenTtlSeconds, 'access'),
      refreshToken: this.tokens.sign(user, accessTokenTtlSeconds * 24, 'refresh'),
      expiresIn: accessTokenTtlSeconds,
      user: { id: user.id, name: user.name, email: user.email, role: primaryRole(user.roles), country: user.country, permissions: user.permissions },
    };
  }
}
