import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FormConfigResponseDto {
  @ApiProperty({ example: 'cfg-claim-create' })
  id!: string | number;

  @ApiProperty({ example: 'claim-create' })
  key!: string;

  @ApiProperty({ example: 'New Claim Request' })
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ example: 'claims' })
  domain!: string;

  @ApiProperty({
    description:
      'Form schema: { fields: [...] } or { sections: [{ key, label, fields: [...] }] }. Field contract matches Fleetzen task forms.',
  })
  metaData!: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  actions?: Record<string, unknown>[] | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiPropertyOptional({
    description: 'Entity context merged in when the config was fetched for a specific claim',
  })
  context?: Record<string, unknown>;

  @ApiPropertyOptional()
  createdAt?: string | Date;

  @ApiPropertyOptional()
  updatedAt?: string | Date;
}
