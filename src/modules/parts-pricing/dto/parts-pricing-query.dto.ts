import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const PARTS_SEARCH_TYPES = ['PART_NAME', 'WORKSHOP', 'VEHICLE'] as const;
export const PARTS_SORT_FIELDS = ['approved_date', 'approved_price', 'part_name'];

export class PartsPricingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PARTS_SEARCH_TYPES, description: 'Omit to match part name, workshop and vehicle' })
  @IsOptional() @IsIn(PARTS_SEARCH_TYPES as unknown as string[])
  searchType?: (typeof PARTS_SEARCH_TYPES)[number];

  @ApiPropertyOptional({ example: 'BRAKING' }) @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ example: 'Toyota' }) @IsOptional() @IsString() make?: string;
  @ApiPropertyOptional({ example: 'Camry' }) @IsOptional() @IsString() model?: string;
  @ApiPropertyOptional({ example: 'NG' }) @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional({ example: 'approved_date:desc', description: `field:asc|desc — ${PARTS_SORT_FIELDS.join(', ')}` })
  @IsOptional() @IsString() sort?: string;
}
