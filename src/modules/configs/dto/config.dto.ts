import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CONFIG_TYPES, ConfigAction } from '../types/config.types';

export class ConfigResponseDto {
  @ApiProperty({ example: 'cfg-claim-create' }) id!: string;
  @ApiProperty({ example: 'claim-create' }) key!: string;
  @ApiProperty({ enum: CONFIG_TYPES }) type!: string;
  @ApiProperty({ example: 'New Claim Request' }) title!: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty({ example: 'claims' }) domain!: string;
  @ApiProperty({ example: '*', description: "'*' = all countries" }) country!: string;
  @ApiProperty({
    description:
      'Schema the UI renders from. FORM/FILTERS: { sections[] | fields[] , constraints? }. TABLE: { endpoint, columns[] }. WORKFLOW: { statuses, rails, actions, reviewTargets }. SETTINGS: constants.',
  })
  metaData!: Record<string, unknown>;
  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } }) actions?: ConfigAction[] | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ example: 1 }) version!: number;
  @ApiProperty({ description: 'Changes whenever the config changes — use for client caching' }) etag!: string;
  @ApiPropertyOptional({ description: 'Entity context used to resolve {{context.*}} placeholders and source:"context" rules' })
  context?: Record<string, unknown>;
  @ApiPropertyOptional({ description: 'Server-computed default values for the form (e.g. current split)' })
  initialValues?: Record<string, unknown>;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ConfigBootstrapDto {
  @ApiProperty({ description: 'Hash over every active config; send as If-None-Match' }) etag!: string;
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ type: [ConfigResponseDto] }) configs!: ConfigResponseDto[];
}
