import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateConfigDto {
  @ApiPropertyOptional({ example: 'Upload Repair Quote' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Replacement form schema (fields/sections)',
  })
  @IsOptional()
  @IsObject()
  metaData?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  actions?: Record<string, unknown>[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
