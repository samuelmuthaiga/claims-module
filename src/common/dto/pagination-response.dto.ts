import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 10 }) limit!: number;
  @ApiProperty({ example: 100 }) total!: number;
  @ApiProperty({ example: 10 }) totalPages!: number;
  @ApiProperty({ example: true }) hasNextPage!: boolean;
  @ApiProperty({ example: false }) hasPreviousPage!: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMetaDto;
}
