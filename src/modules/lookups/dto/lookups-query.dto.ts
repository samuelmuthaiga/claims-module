import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CLAIM_TYPES, WARRANTY_TYPES } from '../../../domain/claim.types';
import { ToBoolean } from '../../../common/utils/query.util';

export const CAR_SEARCH_TYPES = ['VIN', 'CAR_ID', 'PLATE_NUMBER', 'CUSTOMER_NAME', 'CUSTOMER_EMAIL', 'CUSTOMER_PHONE', 'WARRANTY_ID'] as const;

const toInt = () => Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)));

export class CarSearchQueryDto {
  @ApiPropertyOptional({ enum: CAR_SEARCH_TYPES, description: 'Required together with `search`. WARRANTY_ID is used for cash warranties.' })
  @IsOptional() @IsIn(CAR_SEARCH_TYPES as unknown as string[])
  searchType?: (typeof CAR_SEARCH_TYPES)[number];

  @ApiPropertyOptional({ description: '2–100 characters' }) @IsOptional() @IsString() @MinLength(2) @MaxLength(100) search?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @toInt() @IsInt() @Min(1) page: number = 1;
  @ApiPropertyOptional({ default: 8, maximum: 25 }) @IsOptional() @toInt() @IsInt() @Min(1) @Max(25) limit: number = 8;
}

export class VendorsQueryDto {
  @ApiPropertyOptional({ example: 'NG' }) @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional({ example: 'Ikeja' }) @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional({ example: 'GENERAL' }) @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ default: false, description: 'Include inactive workshops' })
  @IsOptional() @ToBoolean() @IsBoolean() includeInactive?: boolean;
}

export class SearchTypesQueryDto {
  @ApiPropertyOptional({ enum: CLAIM_TYPES }) @IsOptional() @IsIn(CLAIM_TYPES as unknown as string[]) claimType?: string;
  @ApiPropertyOptional({ enum: WARRANTY_TYPES }) @IsOptional() @IsIn(WARRANTY_TYPES as unknown as string[]) warrantyType?: string;
}

export class StatesQueryDto {
  @ApiPropertyOptional({ example: 'NG' }) @IsOptional() @IsString() country?: string;
}

export class CitiesQueryDto extends StatesQueryDto {
  @ApiPropertyOptional({ example: 'LA', description: 'State code from /lookups/states' }) @IsOptional() @IsString() state?: string;
}
