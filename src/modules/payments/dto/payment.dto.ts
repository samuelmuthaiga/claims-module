import { IsEnum, IsString, IsOptional, IsNumber, Min } from 'class-validator';

export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  PAID = 'PAID',
}

export class PaymentSummaryResponseDto {
  pending!: number;
  approved!: number;
  paid!: number;
  totalAmount!: number;
  currency!: string;
}

export class PaymentQuoteResponseDto {
  id!: number;
  claimId!: number;
  quoteId!: number;
  amount!: number;
  currency!: string;
  status!: string;
  createdAt!: string;
}

export class PaymentRequestDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  currency!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class PaymentActionDto {
  @IsEnum(PaymentStatus)
  action!: PaymentStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
