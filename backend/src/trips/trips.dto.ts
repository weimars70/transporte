import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod, PricingMode, VehicleType } from '../generated/prisma/client.js';

export class EstimateTripDto {
  @IsLatitude()
  originLat: number;

  @IsLongitude()
  originLng: number;

  @IsLatitude()
  destLat: number;

  @IsLongitude()
  destLng: number;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}

export class CreateTripDto extends EstimateTripDto {
  @IsString()
  @Length(2, 250)
  originAddress: string;

  @IsString()
  @Length(2, 250)
  destAddress: string;

  @IsOptional()
  @IsEnum(PricingMode)
  pricingMode?: PricingMode;

  /** Precio que propone el pasajero (obligatorio en modo BIDDING) */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  proposedFare?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  payment?: PaymentMethod;
}

export class OfferDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

export class CancelTripDto {
  @IsOptional()
  @IsString()
  @Length(0, 250)
  reason?: string;
}

export class RateTripDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class AssignDriverDto {
  @IsString()
  driverId: string;
}

export class CreateAdminTripDto {
  @IsString()
  @Length(2, 100)
  passengerName: string;

  @IsString()
  @Length(5, 25)
  passengerPhone: string;

  @IsString()
  @Length(2, 250)
  originAddress: string;

  @IsLatitude()
  originLat: number;

  @IsLongitude()
  originLng: number;

  @IsString()
  @Length(2, 250)
  destAddress: string;

  @IsLatitude()
  destLat: number;

  @IsLongitude()
  destLng: number;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsEnum(PaymentMethod)
  payment?: PaymentMethod;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fare?: number;

  @IsOptional()
  @IsString()
  driverId?: string;
}

