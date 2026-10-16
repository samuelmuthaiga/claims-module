import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength,
} from 'class-validator';
import { CONFIG_TYPES } from '../types/config.types';

export class CreateConfigDto {
  @ApiProperty({ example: 'quote-upload' })
  @IsString() @IsNotEmpty() @MaxLength(120)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, { message: 'key must be lowercase letters, numbers and hyphens' })
  key!: string;

  @ApiProperty({ enum: CONFIG_TYPES })
  @IsIn(CONFIG_TYPES as unknown as string[])
  type!: (typeof CONFIG_TYPES)[number];

  @ApiProperty({ example: 'Upload Repair Quote' })
  @IsString() @IsNotEmpty() @MaxLength(255)
  title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ example: 'claims', default: 'claims' })
  @IsOptional() @IsString() @MaxLength(60)
  domain?: string;

  @ApiPropertyOptional({ example: '*', default: '*', description: "Country code, or '*' for all" })
  @IsOptional() @IsString() @MaxLength(8)
  country?: string;

  @ApiProperty({ description: 'Schema for the given config type (validated server-side)' })
  @IsObject()
  metaData!: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional() @IsArray()
  actions?: Record<string, unknown>[];

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
