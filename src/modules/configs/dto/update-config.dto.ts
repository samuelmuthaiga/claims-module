import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConfigDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ description: 'Replacement schema (validated server-side)' })
  @IsOptional() @IsObject()
  metaData?: Record<string, unknown>;
  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional() @IsArray()
  actions?: Record<string, unknown>[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
