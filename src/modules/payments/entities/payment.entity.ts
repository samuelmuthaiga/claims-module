import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Claim } from '../../claims/entities/claim.entity';

@Entity('payments', { schema: 'claims' })
export class Payment extends BaseEntity {
  @Column({ name: 'claim_id' })
  claimId!: number;

  @Column({ name: 'quote_id', nullable: true })
  quoteId!: number;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  amount!: number;

  @Column({ length: 3 })
  currency!: string;

  @Column({ length: 16 })
  status!: string;

  @Column({ name: 'payment_type', length: 32, nullable: true })
  paymentType!: string;

  @Column({ name: 'payment_method', length: 32, nullable: true })
  paymentMethod!: string;

  @Column({ name: 'reference_number', length: 64, nullable: true })
  referenceNumber!: string;

  @Column({ name: 'requested_by', length: 64, nullable: true })
  requestedBy!: string;

  @Column({ name: 'approved_by', length: 64, nullable: true })
  approvedBy!: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string;

  @ManyToOne(() => Claim)
  @JoinColumn({ name: 'claim_id' })
  claim!: Claim;
}
