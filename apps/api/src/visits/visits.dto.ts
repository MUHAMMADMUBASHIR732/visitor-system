import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class VisitorInput {
  @IsString() @MinLength(2) @MaxLength(100)
  fullName!: string;

  @IsString() @Matches(/^\+?[0-9\s\-()]{7,20}$/, { message: 'Enter a valid phone number.' })
  phone!: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(100)
  company?: string;

  @IsOptional() @IsString() @MaxLength(30)
  idType?: string;

  @IsOptional() @IsString() @MaxLength(40)
  idNumber?: string;
}

export class CreateVisitDto {
  @ValidateNested() @Type(() => VisitorInput)
  visitor!: VisitorInput;

  @IsString() @MinLength(3) @MaxLength(200)
  purpose!: string;

  @IsDateString()
  expectedFrom!: string;

  @IsDateString()
  expectedTo!: string;

  @IsOptional() @IsString() @MaxLength(20)
  vehiclePlate?: string;

  /** Admins can register a visit on behalf of a host. */
  @IsOptional() @IsUUID()
  hostId?: string;
}

export class ListVisitsDto {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsUUID()
  hostId?: string;

  @IsOptional() @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number;
}

export class WalkInDto {
  @ValidateNested() @Type(() => VisitorInput)
  visitor!: VisitorInput;

  @IsUUID()
  hostId!: string;

  @IsString() @MinLength(3) @MaxLength(200)
  purpose!: string;

  @IsOptional() @IsString() @MaxLength(20)
  vehiclePlate?: string;
}

export class ScanDto {
  /** The signed token read from a QR code. */
  @IsOptional() @IsString() @MaxLength(300)
  token?: string;

  /** The 6-digit code typed in when a QR code cannot be scanned. */
  @IsOptional() @Matches(/^\d{6}$/, { message: 'The pass code has 6 digits.' })
  code?: string;
}

export class CheckInDto {
  @IsOptional() @IsString() @MaxLength(20)
  vehiclePlate?: string;
}
