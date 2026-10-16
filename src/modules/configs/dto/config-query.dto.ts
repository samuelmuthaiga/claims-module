import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CONFIG_TYPES } from '../types/config.types';

export class ListConfigsQueryDto {
  @ApiPropertyOptional({ enum: CONFIG_TYPES })
  @IsOptional() @IsIn(CONFIG_TYPES as unknown as string[])
  type?: string;

  @ApiPropertyOptional({ example: 'claims' }) @IsOptional() @IsString() domain?: string;
  @ApiPropertyOptional({ example: 'NG' }) @IsOptional() @IsString() @MaxLength(8) country?: string;
}

export class GetConfigQueryDto {
  @ApiPropertyOptional({ example: 'NG', description: 'Prefers a country-specific config over the global one' })
  @IsOptional() @IsString() @MaxLength(8)
  country?: string;

  @ApiPropertyOptional({ enum: ['claim', 'payment', 'approval', 'schedule'], description: 'Hydrates context + initialValues' })
  @IsOptional() @IsIn(['claim', 'payment', 'approval', 'schedule'])
  entityType?: 'claim' | 'payment' | 'approval' | 'schedule';

  @ApiPropertyOptional({ description: 'Entity id (claim/payment/approval id, or a schedule token)' })
  @IsOptional() @IsString() @MaxLength(128)
  entityId?: string;
}

export class BootstrapQueryDto {
  @ApiPropertyOptional({ example: 'NG' }) @IsOptional() @IsString() @MaxLength(8) country?: string;
}
