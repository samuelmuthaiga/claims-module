import { IsEnum, IsString, IsOptional, MinLength, MaxLength, IsNumber } from 'class-validator';

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
}

export enum ApprovalType {
  QUOTE = 'QUOTE',
  DIAGNOSIS = 'DIAGNOSIS',
  PAYMENT = 'PAYMENT',
  QA = 'QA',
}

export class ApprovalResponseDto {
  id!: number;
  claimId!: number;
  type!: string;
  subjectId!: number;
  status!: string;
  submittedBy!: string;
  submittedAt!: string;
  decidedBy!: string | null;
  decidedAt!: string | null;
  decisionReason!: string | null;
  version!: number;
}

export class ApprovalSummaryResponseDto {
  pending!: number;
  approved!: number;
  declined!: number;
  total!: number;
}

export class ApprovalDecisionDto {
  @IsEnum(ApprovalStatus)
  decision!: ApprovalStatus;

  @IsString()
  @IsOptional()
  @MinLength(10)
  @MaxLength(500)
  reason?: string;
}
