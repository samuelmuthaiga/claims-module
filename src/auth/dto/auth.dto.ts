import { IsString, IsEmail, IsOptional } from 'class-validator';

export class SsoLoginDto {
  @IsString()
  token!: string;

  @IsString()
  @IsOptional()
  provider?: string;
}

export class UserDto {
  id!: string;
  email!: string;
  name!: string;
  role!: string;
  country!: string;
  permissions!: string[];
}

export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  user!: UserDto;
}
