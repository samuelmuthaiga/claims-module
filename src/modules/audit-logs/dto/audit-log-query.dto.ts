import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const AUDIT_SEARCH_TYPES = ['LOG_ID', 'ACTION', 'PERFORMED_BY', 'ENTITY_ID'] as const;

export class AuditLogQueryDto extends PaginationQueryDto {
  declare limit: number;

  constructor() {
    super();
    this.limit = 20;
  }

  @ApiPropertyOptional({ enum: AUDIT_SEARCH_TYPES })
  @IsOptional() @IsIn(AUDIT_SEARCH_TYPES as unknown as string[])
  searchType?: (typeof AUDIT_SEARCH_TYPES)[number];

  @ApiPropertyOptional({ example: 'CLAIMS' }) @IsOptional() @IsString() module?: string;
  @ApiPropertyOptional({ example: 'QUOTE_APPROVED' }) @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional({ example: 'approval', description: 'Machine value or UI label (e.g. "Claim Request")' })
  @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() severity?: string;

  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value))) @IsInt()
  claimId?: number;

  @ApiPropertyOptional({ example: '2026-10-01' }) @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional({ example: '2026-10-31' }) @IsOptional() @IsISO8601() to?: string;
}
