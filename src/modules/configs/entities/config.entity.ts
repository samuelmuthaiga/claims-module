import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';

/**
 * A form configuration template. `key` identifies which Claims UI form the
 * metaData renders (e.g. "claim-create", "quote-upload"); `metaData` holds
 * the field/section schema the UI consumes, in the same shape Fleetzen's
 * task forms use so the renderer pattern carries over.
 */
@Entity('form_configs')
export class FormConfig extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 120 })
  key!: string;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 60, default: 'claims' })
  domain!: string;

  @Column({ type: 'jsonb' })
  metaData!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  actions!: Record<string, unknown>[] | null;

  @Column({ default: true })
  isActive!: boolean;
}
