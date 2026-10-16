import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';

/**
 * A UI configuration (form, filter bar, table, workflow or settings). `key`
 * identifies it to the UI; `country` '*' is the global default and a country
 * code overrides it. `metaData` holds the schema the UI renders from.
 */
@Entity('claim_configs')
@Index(['key', 'country'], { unique: true })
export class ConfigEntity extends BaseEntity {
  @Column({ length: 120 })
  key!: string;

  @Column({ length: 20 })
  type!: string;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 60, default: 'claims' })
  domain!: string;

  @Column({ length: 8, default: '*' })
  country!: string;

  @Column({ type: 'jsonb', name: 'meta_data' })
  metaData!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  actions!: Record<string, unknown>[] | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
