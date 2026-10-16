import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ToBoolean } from '../../../common/utils/query.util';
import { APPROVAL_TYPES, ApprovalType } from '../../../domain/claim.types';
import { Transform } from 'class-transformer';

export const REVIEW_SEARCH_TYPES = ['ID', 'CLAIM_ID', 'CUSTOMER_NAME', 'CUSTOMER_EMAIL', 'VENDOR', 'DESCRIPTION', 'ACCOUNT_NAME'] as const;

export class ListApprovalsQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: APPROVAL_TYPES, description: 'DIAGNOSIS = Requests tab, QUOTE = Quotes, QA_SIGNOFF = Repairs/QC, PAYMENT = payment approvals' })
  @IsIn(APPROVAL_TYPES as unknown as string[])
  type!: ApprovalType;

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'DECLINED'], default: 'PENDING' })
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'DECLINED'])
  status: string = 'PENDING';

  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value))) @IsInt() claimId?: number;
  @ApiPropertyOptional({ example: 'NG' }) @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional({ example: 'v-101' }) @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional({ enum: REVIEW_SEARCH_TYPES })
  @IsOptional() @IsIn(REVIEW_SEARCH_TYPES as unknown as string[])
  searchType?: (typeof REVIEW_SEARCH_TYPES)[number];

  @ApiPropertyOptional() @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() to?: string;
  @ApiPropertyOptional({ default: 'submitted_at:asc' }) @IsOptional() @IsString() sort?: string;
  @ApiPropertyOptional({ description: 'Only items past their SLA' }) @IsOptional() @ToBoolean() @IsBoolean() overdue?: boolean;
}

export class ApprovalDecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'DECLINE'] }) @IsIn(['APPROVE', 'DECLINE']) decision!: 'APPROVE' | 'DECLINE';

  @ApiPropertyOptional({ minLength: 10, maxLength: 500, description: 'Required (10–500 characters) when declining — enforced by the approval-decision form config' })
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}
