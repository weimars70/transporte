import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VehicleType } from '../generated/prisma/client.js';

export class LoginDto {
  @IsString()
  @Length(6, 20)
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterPassengerDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @IsString()
  @Matches(/^\+?\d{6,15}$/, { message: 'Teléfono inválido' })
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class VehicleDto {
  @IsEnum(VehicleType)
  type: VehicleType;

  @IsString()
  @Length(1, 40)
  brand: string;

  @IsString()
  @Length(1, 40)
  model: string;

  @IsString()
  @Length(1, 30)
  color: string;

  @IsString()
  @Length(4, 12)
  plate: string;

  @IsInt()
  @Min(1980)
  @Max(2100)
  year: number;
}

export class RegisterDriverDto extends RegisterPassengerDto {
  @IsString()
  @Length(4, 30)
  licenseNumber: string;

  @ValidateNested()
  @Type(() => VehicleDto)
  vehicle: VehicleDto;
}
