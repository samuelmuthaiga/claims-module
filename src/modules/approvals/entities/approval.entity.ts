import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Claim } from '../../claims/entities/claim.entity';

@Entity('approvals', { schema: 'claims' })
@Index(['type', 'subjectId'], { unique: true, where: "status = 'PENDING'" })
export class Approval extends BaseEntity {
  @Column({ name: 'claim_id' })
  claimId!: number;

  @Column({ length: 16 })
  type!: string;

  @Column({ name: 'subject_id', nullable: true })
  subjectId!: number;

  @Column({ length: 12 })
  status!: string;

  @Column({ default: 1 })
  revision!: number;

  @Column({ name: 'submitted_by', length: 64 })
  submittedBy!: string;

  @Column({ name: 'submitted_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt!: Date;

  @Column({ name: 'decided_by', length: 64, nullable: true })
  decidedBy!: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @Column({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason!: string | null;

  @Column({ name: 'second_approver_id', length: 64, nullable: true })
  secondApproverId!: string;

  @Column({ name: 'second_decided_at', type: 'timestamptz', nullable: true })
  secondDecidedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date;

  @ManyToOne(() => Claim)
  @JoinColumn({ name: 'claim_id' })
  claim!: Claim;
}
