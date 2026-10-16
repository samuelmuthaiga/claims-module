import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class SubmitConfigValuesDto {
  @ApiProperty({
    example: { claimType: 'WARRANTY', warrantyType: 'CASH_WARRANTY', requestChannel: 'PHONE_CALL' },
    description: 'Form values keyed by field key',
  })
  @IsObject()
  values!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Entity context for context-aware rules/constraints (e.g. { quoteTotal: 450000, repairFinanced: false })',
  })
  @IsOptional() @IsObject()
  context?: Record<string, unknown>;
}

export class SubmitConfigValuesResponseDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty({ example: [{ key: 'warrantyType', message: 'Please select the warranty type' }] })
  errors!: { key: string; message: string }[];
  @ApiPropertyOptional({ description: 'Schema with the submitted values applied' })
  metaData?: Record<string, unknown>;
}
