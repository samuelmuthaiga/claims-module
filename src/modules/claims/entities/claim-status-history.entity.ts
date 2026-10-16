import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Claim } from './claim.entity';

@Entity('claim_status_history', { schema: 'claims' })
@Index(['claimId', 'occurredAt'])
export class ClaimStatusHistory extends BaseEntity {
  @Column({ name: 'claim_id' })
  claimId!: number;

  @Column({ name: 'from_status', length: 40, nullable: true })
  fromStatus!: string;

  @Column({ name: 'to_status', length: 40 })
  toStatus!: string;

  @Column({ length: 48 })
  action!: string;

  @Column({ name: 'actor_id', length: 64 })
  actorId!: string;

  @Column({ name: 'actor_role', length: 32 })
  actorRole!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string;

  @Column({ name: 'workflow_version' })
  workflowVersion!: number;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @ManyToOne(() => Claim)
  @JoinColumn({ name: 'claim_id' })
  claim!: Claim;
}
