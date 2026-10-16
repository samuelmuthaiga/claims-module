import { IsEnum, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export enum SearchType {
  VIN = 'VIN',
  CAR_ID = 'CAR_ID',
  PLATE_NUMBER = 'PLATE_NUMBER',
  CUSTOMER_NAME = 'CUSTOMER_NAME',
  CUSTOMER_EMAIL = 'CUSTOMER_EMAIL',
  CUSTOMER_PHONE = 'CUSTOMER_PHONE',
}

export class SearchCarsDto {
  @IsEnum(SearchType)
  @IsOptional()
  searchType?: SearchType;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  search?: string;
}

export class CarLookupDto {
  value!: string;
  label!: string;
  email!: string;
  car!: {
    id: string;
    loanId: string;
    acquireId: string;
    warrantyId: string;
    vin: string;
    plateNumber: string;
    make: string;
    model: string;
    year: number;
    price: number;
    currency: string;
    customerId: string;
  };
  customer!: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  eligibility!: {
    warranty: { eligible: boolean; reason: string | null };
    repairs: { eligible: boolean; reason: string | null };
    insurance: { eligible: boolean; reason: string | null };
  };
}

export class EnumDto {
  code!: string;
  label!: string;
  description?: string;
}

export class CountryDto {
  code!: string;
  name!: string;
  currency!: string;
  callingCode!: string;
}

export class VendorDto {
  id!: string;
  name!: string;
  country!: string;
  city!: string;
  active!: boolean;
}
