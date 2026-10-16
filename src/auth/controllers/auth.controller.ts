import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { SsoLoginDto, UserDto, LoginResponseDto } from '../dto/auth.dto';
import { ResponseDto } from '../../common/dto/response.dto';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sso/login')
  @ApiOperation({ summary: 'SSO login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async ssoLogin(@Body() ssoLoginDto: SsoLoginDto): Promise<ResponseDto<LoginResponseDto>> {
    return {
      data: await this.authService.ssoLogin(ssoLoginDto),
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user information' })
  async getCurrentUser(): Promise<ResponseDto<UserDto>> {
    return {
      data: await this.authService.getCurrentUser(),
    };
  }
}
