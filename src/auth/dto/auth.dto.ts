import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SsoLoginDto {
  @ApiProperty({ description: 'Token issued by the identity provider', example: 'sso_token_from_identity_provider' })
  @IsString() @IsNotEmpty()
  token!: string;
}
