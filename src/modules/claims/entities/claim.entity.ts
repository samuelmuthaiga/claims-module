import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';

@Entity('claims', { schema: 'claims' })
@Index(['country', 'status', 'createdAt'])
@Index(['carId'])
@Index(['customerId'])
@Index(['vendorId', 'status'])
export class Claim extends BaseEntity {
  @Column({ name: 'reference', unique: true, length: 24 })
  reference!: string;

  @Column({ name: 'job_order_number', unique: true, length: 24 })
  jobOrderNumber!: string;

  @Column({ name: 'claim_type', length: 12 })
  claimType!: string;

  @Column({ name: 'warranty_type', length: 16, nullable: true })
  warrantyType!: string;

  @Column({ name: 'status', length: 40 })
  status!: string;

  @Column({ name: 'workflow_config_id' })
  workflowConfigId!: number;

  @Column({ name: 'workflow_version' })
  workflowVersion!: number;

  @Column({ length: 2 })
  country!: string;

  @Column({ length: 3 })
  currency!: string;

  @Column({ name: 'customer_id', length: 64 })
  customerId!: string;

  @Column({ name: 'car_id', length: 64 })
  carId!: string;

  @Column({ name: 'loan_id', length: 64, nullable: true })
  loanId!: string;

  @Column({ name: 'warranty_id', length: 64, nullable: true })
  warrantyId!: string;

  @Column({ name: 'vendor_id', length: 64, nullable: true })
  vendorId!: string;

  @Column({ name: 'customer_snapshot', type: 'jsonb' })
  customerSnapshot!: Record<string, any>;

  @Column({ name: 'car_snapshot', type: 'jsonb' })
  carSnapshot!: Record<string, any>;

  @Column({ name: 'vendor_snapshot', type: 'jsonb', nullable: true })
  vendorSnapshot!: Record<string, any>;

  @Column({ name: 'snapshot_at', type: 'timestamptz' })
  snapshotAt!: Date;

  @Column({ name: 'request_channel', length: 16 })
  requestChannel!: string;

  @Column({ name: 'initial_details', type: 'text' })
  initialDetails!: string;

  @Column({ name: 'issue_sub_type', length: 64, nullable: true })
  issueSubType!: string;

  @Column({ name: 'issue_types', type: 'simple-array', nullable: true })
  issueTypes!: string[];

  @Column({ nullable: true })
  odometer!: number;

  @Column({ name: 'repair_financed', default: false })
  repairFinanced!: boolean;

  @Column({ name: 'upfront_amount', type: 'numeric', precision: 18, scale: 4, nullable: true })
  upfrontAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 18, scale: 4, nullable: true })
  totalAmount!: number;

  @Column({ name: 'warranty_cap_used', type: 'numeric', precision: 18, scale: 4, default: 0 })
  warrantyCapUsed!: number;

  @Column({ name: 'repair_authorized_at', type: 'timestamptz', nullable: true })
  repairAuthorizedAt!: Date;

  @Column({ name: 'qa_state', length: 32, nullable: true })
  qaState!: string;

  @Column({ name: 'decline_count', default: 0 })
  declineCount!: number;

  @Column({ name: 'legacy_status', length: 40, nullable: true })
  legacyStatus!: string;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason!: string;

  @Column({ name: 'cancelled_by', length: 64, nullable: true })
  cancelledBy!: string;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date;
}
