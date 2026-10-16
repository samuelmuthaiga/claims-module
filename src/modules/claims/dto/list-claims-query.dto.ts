import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ToStringArray } from '../../../common/utils/query.util';
import { CLAIM_TYPES, ClaimStatus } from '../../../domain/claim.types';

export const CLAIM_SEARCH_TYPES = ['CLAIM_ID', 'CUSTOMER_NAME', 'CUSTOMER_EMAIL', 'VIN', 'PLATE_NUMBER', 'CAR_ID', 'LOAN_ID'] as const;
export const CLAIM_SORT_FIELDS = ['created_at', 'request_date', 'status', 'id'];

export class ListClaimsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'NG' }) @IsOptional() @IsString() @MaxLength(8) country?: string;

  @ApiPropertyOptional({ type: [String], example: 'DIAGNOSIS_IN_PROGRESS,REPAIR_ONGOING', description: 'Comma-separated or repeated' })
  @IsOptional() @ToStringArray() @IsArray() @IsIn(Object.values(ClaimStatus), { each: true })
  status?: string[];

  @ApiPropertyOptional({ enum: CLAIM_TYPES }) @IsOptional() @IsIn(CLAIM_TYPES as unknown as string[]) claimType?: string;

  @ApiPropertyOptional({ enum: CLAIM_SEARCH_TYPES, description: 'Which field `search` matches' })
  @IsOptional() @IsIn(CLAIM_SEARCH_TYPES as unknown as string[])
  searchType?: (typeof CLAIM_SEARCH_TYPES)[number];

  @ApiPropertyOptional({ description: '2–100 characters' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: 'v-101' }) @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional({ example: 'ASSIGNED' }) @IsOptional() @IsString() qaState?: string;
  @ApiPropertyOptional({ example: '2026-10-01', description: 'Filter on requestDate (inclusive)' }) @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional({ example: '2026-10-31' }) @IsOptional() @IsISO8601() to?: string;
  @ApiPropertyOptional({ example: 'created_at:desc', description: `field:asc|desc — fields: ${CLAIM_SORT_FIELDS.join(', ')}` })
  @IsOptional() @IsString() sort?: string;
}
