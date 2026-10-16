import { IsEnum, IsString, IsOptional, IsArray, MinLength, MaxLength } from 'class-validator';

export enum ClaimType {
  WARRANTY = 'WARRANTY',
  REPAIRS = 'REPAIRS',
  INSURANCE = 'INSURANCE',
}

export enum WarrantyType {
  LOAN_WARRANTY = 'LOAN_WARRANTY',
  CASH_WARRANTY = 'CASH_WARRANTY',
}

export enum RequestChannel {
  PHONE_CALL = 'PHONE_CALL',
  EMAIL = 'EMAIL',
}

export class CreateClaimDto {
  @IsEnum(ClaimType)
  claimType!: ClaimType;

  @IsEnum(WarrantyType)
  @IsOptional()
  warrantyType?: WarrantyType;

  @IsString()
  carId!: string;

  @IsString()
  customerPhone!: string;

  @IsEnum(RequestChannel)
  requestChannel!: RequestChannel;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  initialDetails!: string;

  @IsString()
  @IsOptional()
  supportingFileId?: string;
}
