import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseWrapper {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty({ example: 200 }) statusCode!: number;
  @ApiProperty({ description: 'Resource payload' }) data!: unknown;
  @ApiPropertyOptional({ description: 'Pagination metadata for list endpoints' })
  meta?: Record<string, unknown>;
  @ApiProperty({ example: '2026-10-16T10:00:00.000Z' }) timestamp!: string;
}

export class ApiErrorResponseWrapper {
  @ApiProperty({ example: false }) success!: boolean;
  @ApiProperty({ example: 422 }) statusCode!: number;
  @ApiProperty({ example: 'VALIDATION_FAILED' }) errorCode!: string;
  @ApiProperty({ example: 'Request validation failed' }) message!: string;
  @ApiPropertyOptional({
    description: 'Field-keyed validation errors',
    example: [{ key: 'reason', message: 'reason must be longer than 10 characters' }],
  })
  errors?: { key: string; message: string }[];
  @ApiPropertyOptional() requestId?: string;
  @ApiPropertyOptional() path?: string;
  @ApiProperty() timestamp!: string;
}
