import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { ApiOkEnvelope } from '../../common/decorators/api-response.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { SsoLoginDto } from '../dto/auth.dto';
import { AuthUser } from '../interfaces/auth-user.interface';
import { AuthService } from '../services/auth.service';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('sso/login')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange an SSO token for claims-service tokens (non-production stub)' })
  @ApiOkEnvelope('Tokens and profile')
  ssoLogin(@Body() dto: SsoLoginDto) {
    return this.auth.ssoLogin(dto);
  }

  @Get('me')
  @ApiAuth()
  @ApiOperation({ summary: 'Current user: role, permissions, feature flags and the UI config etag' })
  @ApiOkEnvelope('Profile')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.profile(user);
  }
}
