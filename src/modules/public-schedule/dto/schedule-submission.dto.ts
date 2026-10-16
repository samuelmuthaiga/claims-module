import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { values } from '../../../domain/enums';

export class ScheduleSubmissionDto {
  @ApiPropertyOptional({ enum: ['WARRANTY', 'REPAIRS'], description: 'Only when the customer is asked to confirm the type' })
  @IsOptional() @IsIn(['WARRANTY', 'REPAIRS'])
  repairType?: 'WARRANTY' | 'REPAIRS';

  @ApiProperty({ enum: values('repairCategories') }) @IsIn(values('repairCategories')) category!: string;
  @ApiProperty({ example: 'v-101' }) @IsString() @IsNotEmpty() vendorId!: string;
  @ApiProperty({ example: '2026-10-20T09:00:00.000Z' }) @IsISO8601() appointmentDate!: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) customerNotes?: string;
  @ApiPropertyOptional({ description: 'Reserved for the bot-protection provider' }) @IsOptional() @IsString() captchaToken?: string;
}

export class SlotsQueryDto {
  @ApiProperty({ example: 'v-101' }) @IsString() @IsNotEmpty() vendorId!: string;
  @ApiProperty({ example: '2026-10-20' }) @IsISO8601() from!: string;
  @ApiProperty({ example: '2026-10-27' }) @IsISO8601() to!: string;
}

export class ScheduleVendorsQueryDto {
  @ApiPropertyOptional({ example: 'Ikeja', description: 'Filter by city name' }) @IsOptional() @IsString() city?: string;
}

export class ScheduleStateQueryDto {
  @ApiPropertyOptional({ example: 'LA' }) @IsOptional() @IsString() state?: string;
}
