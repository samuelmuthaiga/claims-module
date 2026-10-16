import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateConfigDto {
  @ApiProperty({
    example: 'quote-upload',
    description: 'Unique form key the UI uses to fetch this config',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  key!: string;

  @ApiProperty({ example: 'Upload Repair Quote' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    example: 'Submit the diagnosis and the priced quote for claims admin review',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'claims', default: 'claims' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({
    description:
      'Form schema. Either { fields: [...] } for a flat form or { sections: [{ key, label, fields: [...] }] } for a sectioned form. Field shape follows Fleetzen: key, type, label, required, required_if, options, options_source, validation, auto_populate, etc.',
    example: {
      title: 'Upload Repair Quote',
      sections: [
        {
          key: 'diagnosis',
          label: 'Diagnosis',
          fields: [
            {
              key: 'diagnosisReportUrl',
              type: 'file',
              label: 'Diagnosis Report',
              required: true,
            },
          ],
        },
      ],
    },
  })
  @IsObject()
  metaData!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Action buttons/submit behaviour for the form',
    example: [
      {
        key: 'submit',
        label: 'Upload Quote',
        style: 'primary',
        endpoint: '/api/v1/claims/:claimId/quotes',
        method: 'POST',
      },
    ],
  })
  @IsOptional()
  actions?: Record<string, unknown>[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
