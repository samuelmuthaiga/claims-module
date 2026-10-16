import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { CLAIM_TYPES, ClaimType, REQUEST_CHANNELS, RequestChannel, WARRANTY_TYPES, WarrantyType } from '../../../domain/claim.types';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateClaimDto {
  @ApiProperty({ enum: CLAIM_TYPES }) @IsIn(CLAIM_TYPES as unknown as string[]) claimType!: ClaimType;

  @ApiPropertyOptional({ enum: WARRANTY_TYPES, description: 'Required when claimType is WARRANTY' })
  @ValidateIf((o: CreateClaimDto) => o.claimType === 'WARRANTY')
  @IsIn(WARRANTY_TYPES as unknown as string[])
  warrantyType?: WarrantyType;

  @ApiProperty({ example: 'car-991' }) @IsString() @IsNotEmpty() carId!: string;

  @ApiProperty({ example: '+2348012345678', description: 'E.164' })
  @trim() @Matches(/^\+[1-9]\d{7,14}$/, { message: 'customerPhone must be in E.164 format, e.g. +2348012345678' })
  customerPhone!: string;

  @ApiProperty({ enum: REQUEST_CHANNELS }) @IsIn(REQUEST_CHANNELS as unknown as string[]) requestChannel!: RequestChannel;

  @ApiProperty({ minLength: 10, maxLength: 4000 }) @trim() @Length(10, 4000) initialDetails!: string;

  @ApiPropertyOptional({ description: 'URL of the uploaded photo/document (current UI)' })
  @IsOptional() @IsString() supportingDocumentUrl?: string;

  @ApiPropertyOptional({ description: 'Confirmed file id (API spec); alternative to supportingDocumentUrl' })
  @IsOptional() @IsString() supportingFileId?: string;
}
