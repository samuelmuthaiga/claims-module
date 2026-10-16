import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsIn, IsISO8601, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Length,
  Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { values } from '../../../domain/enums';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Each file may be sent as a URL (current UI) or a confirmed fileId (API spec). */
export class RequestDiagnosisApprovalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() workshopProofUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workshopProofFileId?: string;
}

export class QuoteLineItemDto {
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) lineNo?: number;
  @ApiProperty({ maxLength: 200 }) @trim() @IsString() @Length(1, 200) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) spec?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @ApiPropertyOptional({ enum: values('partConditions') }) @IsOptional() @IsIn(values('partConditions')) condition?: string;

  @ApiProperty({ minimum: 0.5, maximum: 10, description: 'Increments of 0.5' })
  @Type(() => Number) @IsNumber() @Min(0.5) @Max(10)
  quantity!: number;

  @ApiProperty({ minimum: 0.01 }) @Type(() => Number) @IsNumber() @Min(0.01) unitAmount!: number;

  @ApiPropertyOptional({ description: 'Optional; verified against quantity × unitAmount when sent' })
  @IsOptional() @Type(() => Number) @IsNumber() amount?: number;

  @ApiPropertyOptional({ enum: values('repairCategories') }) @IsOptional() @IsIn(values('repairCategories')) categoryCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() partCatalogId?: string;
}

export class UploadQuoteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() diagnosisReportUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() diagnosisReportFileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scanReportUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scanReportFileId?: string;
  @ApiPropertyOptional({ description: 'Invoice document URL' }) @IsOptional() @IsString() documentUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() invoiceFileId?: string;

  @ApiProperty({ type: [String], example: ['TRANSMISSION'], enum: values('repairCategories') })
  @IsArray() @ArrayMinSize(1) @IsIn(values('repairCategories'), { each: true })
  issueTypes!: string[];

  @ApiPropertyOptional({ maxLength: 4000 }) @IsOptional() @IsString() @MaxLength(4000) diagnosisNotes?: string;

  @ApiProperty({ example: 'INV-88319' })
  @trim() @Matches(/^[A-Za-z0-9_-]{1,64}$/, { message: 'invoiceNumber must be 1-64 characters: letters, numbers, - or _' })
  invoiceNumber!: string;

  @ApiProperty({ minimum: 0 }) @Type(() => Number) @IsNumber() @Min(0) upfrontAmount!: number;
  @ApiProperty({ minimum: 0.01 }) @Type(() => Number) @IsNumber() @Min(0.01) totalAmount!: number;

  @ApiProperty({ type: [QuoteLineItemDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => QuoteLineItemDto)
  lineItems!: QuoteLineItemDto[];
}

export class PaymentSplitDto {
  @ApiProperty({ minimum: 0 }) @Type(() => Number) @IsNumber() @Min(0) customer!: number;
  @ApiProperty({ minimum: 0 }) @Type(() => Number) @IsNumber() @Min(0) autochek!: number;
  @ApiProperty({ minimum: 0 }) @Type(() => Number) @IsNumber() @Min(0) insurance!: number;
  @ApiPropertyOptional({ minimum: 0, default: 0, description: 'Only allowed on repair-financed claims' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  repairFinancing: number = 0;
}

export class RepairCompletionDto {
  @ApiPropertyOptional({ description: 'Proof-of-repair image/document URL' }) @IsOptional() @IsString() afterImageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() afterImageFileId?: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class PickupDto {
  @ApiPropertyOptional() @IsOptional() @IsString() pickupFileUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pickupFileId?: string;
  @ApiPropertyOptional({ example: '2026-10-16T14:00:00.000Z' }) @IsOptional() @IsISO8601() pickupDate?: string;
}

export class CancelClaimDto {
  @ApiProperty({ minLength: 10, maxLength: 500, example: 'Customer requested cancellation' })
  @trim() @IsNotEmpty() @Length(10, 500)
  reason!: string;
}

export class TimelineQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
}
