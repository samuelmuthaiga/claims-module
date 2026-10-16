import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

/**
 * Submitted form values keyed by field key — the same contract Fleetzen's
 * POST /configs/services/:id/submit uses, so the UI's error mapping
 * (errors[] -> form.setErrors) works unchanged.
 */
export class SubmitConfigValuesDto {
  @ApiProperty({
    example: {
      claimType: 'WARRANTY',
      warrantyType: 'CASH_WARRANTY',
      requestChannel: 'Phone Call',
      searchType: 'VIN',
      carId: 'car-991',
      customerPhone: '+2348012345678',
      initialDetails: 'Customer reports engine noise when starting the car.',
    },
  })
  @IsObject()
  values!: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Entity context the validation should run against (e.g. the claim the form is being submitted for). Lets cross-field constraints resolve values like quoteTotal.',
    example: { entityType: 'claim', entityId: 123 },
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class ConfigValidationErrorDto {
  @ApiProperty({ example: 'warrantyType' })
  key!: string;

  @ApiProperty({ example: 'This field is required' })
  message!: string;
}

export class SubmitConfigValuesResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ type: [ConfigValidationErrorDto] })
  errors!: ConfigValidationErrorDto[];

  @ApiPropertyOptional({
    description: 'metaData with submitted values applied onto each field',
  })
  metaData?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Mock submission record echoed back for UI development',
  })
  submission?: Record<string, unknown>;
}
