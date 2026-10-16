import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PAYMENT_STATUSES } from '../../../domain/claim.types';

export const PAYMENT_SEARCH_TYPES = ['ID', 'CUSTOMER_NAME', 'CUSTOMER_EMAIL', 'VENDOR'] as const;
export const PAYMENT_APPROVAL_SEARCH_TYPES = ['ID', 'CUSTOMER_NAME', 'DESCRIPTION', 'ACCOUNT_NAME'] as const;

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PAYMENT_STATUSES, description: 'Omit to list every status' })
  @IsOptional() @IsIn(PAYMENT_STATUSES as unknown as string[])
  paymentStatus?: string;

  @ApiPropertyOptional({ example: 'NG' }) @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional({ example: 'v-101' }) @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional({ enum: PAYMENT_SEARCH_TYPES })
  @IsOptional() @IsIn(PAYMENT_SEARCH_TYPES as unknown as string[])
  searchType?: (typeof PAYMENT_SEARCH_TYPES)[number];
}

export class ListPaymentApprovalsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'DECLINED'], default: 'PENDING' })
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'DECLINED'])
  status: string = 'PENDING';

  @ApiPropertyOptional({ example: 'NG' }) @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional({ enum: PAYMENT_APPROVAL_SEARCH_TYPES })
  @IsOptional() @IsIn(PAYMENT_APPROVAL_SEARCH_TYPES as unknown as string[])
  searchType?: (typeof PAYMENT_APPROVAL_SEARCH_TYPES)[number];
}

export class PaymentSplitInputDto {
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) customer!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) autochek!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) insurance!: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) repairFinancing: number = 0;
}

export class RequestPaymentDto {
  @ApiProperty({ enum: ['quotes', 'repairs'], description: 'Which payment list the row belongs to' })
  @IsIn(['quotes', 'repairs']) list!: 'quotes' | 'repairs';

  @ApiProperty({ description: 'Payment id (the row id in the list)' }) @Type(() => Number) @IsInt() @Min(1) id!: number;
  @ApiProperty({ description: 'Editable by the reviewer' }) @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;

  @ApiProperty({ example: 'INV-88319' })
  @IsString() @IsNotEmpty() @Matches(/^[A-Za-z0-9_-]{1,64}$/, { message: 'invoiceNumber must be 1-64 characters: letters, numbers, - or _' })
  invoiceNumber!: string;

  @ApiProperty({ type: PaymentSplitInputDto }) @ValidateNested() @Type(() => PaymentSplitInputDto)
  paymentSplit!: PaymentSplitInputDto;
}

export const PAYMENT_ACTION_STATUSES = ['APPROVED', 'INVOICE_DECLINED', 'DISPUTED'] as const;

export class PaymentActionDto {
  @ApiProperty({ enum: ['quotes', 'repairs', 'approvals'] })
  @IsIn(['quotes', 'repairs', 'approvals']) list!: 'quotes' | 'repairs' | 'approvals';

  @ApiProperty({ description: 'Approval id for list=approvals, otherwise the payment id' })
  @Type(() => Number) @IsInt() @Min(1) id!: number;

  @ApiPropertyOptional({ description: 'Required for list=approvals: true approves, false declines' })
  @ValidateIf((o: PaymentActionDto) => o.list === 'approvals') @IsBoolean()
  approve?: boolean;

  @ApiPropertyOptional({ enum: PAYMENT_ACTION_STATUSES, description: 'Required for list=quotes|repairs' })
  @ValidateIf((o: PaymentActionDto) => o.list !== 'approvals') @IsIn(PAYMENT_ACTION_STATUSES as unknown as string[])
  newStatus?: (typeof PAYMENT_ACTION_STATUSES)[number];

  @ApiProperty({ minLength: 2, maxLength: 500 }) @IsString() @IsNotEmpty() reason!: string;
}
