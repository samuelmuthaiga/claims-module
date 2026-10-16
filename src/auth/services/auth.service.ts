import { Injectable } from '@nestjs/common';
import { SsoLoginDto, UserDto, LoginResponseDto } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  private mockUser: UserDto = {
    id: 'user-101',
    email: 'john.doe@autochek.com',
    name: 'John Doe',
    role: 'OFFICER',
    country: 'NG',
    permissions: ['claims:read', 'claims:write', 'approvals:read', 'approvals:write'],
  };

  async ssoLogin(ssoLoginDto: SsoLoginDto): Promise<LoginResponseDto> {
    return {
      accessToken: 'mock-jwt-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now(),
      expiresIn: 3600,
      user: this.mockUser,
    };
  }

  async getCurrentUser(): Promise<UserDto> {
    return this.mockUser;
  }
}
