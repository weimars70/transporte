import { Body, Controller, Get, Module, Patch, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsLatitude, IsLongitude, IsOptional } from 'class-validator';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth.js';
import type { AuthUser } from '../common/types.js';
import { Role, VehicleType } from '../generated/prisma/client.js';
import { DriversService } from './drivers.service.js';

class SetOnlineDto {
  @IsBoolean()
  online: boolean;
}

class NearbyQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;
}

@ApiTags('drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drivers')
export class DriversController {
  constructor(
    private readonly drivers: DriversService,
    private readonly config: ConfigService,
  ) {}

  @Roles(Role.DRIVER)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.drivers.getProfile(user.driverId!);
  }

  @Roles(Role.DRIVER)
  @Patch('me/online')
  setOnline(@CurrentUser() user: AuthUser, @Body() dto: SetOnlineDto) {
    return this.drivers.setOnline(user.driverId!, dto.online);
  }

  /** Autos cercanos para pintar en el mapa del pasajero (posición aproximada) */
  @Get('nearby')
  async nearby(@Query() q: NearbyQueryDto) {
    const radius = Number(this.config.get('SEARCH_RADIUS_KM') ?? 5);
    const list = await this.drivers.findNearby(q.lat, q.lng, q.type ?? VehicleType.CAR, radius, 15);
    // No exponemos el id real del conductor al pasajero
    return list.map((d, i) => ({
      id: i,
      lat: Number(d.lat.toFixed(4)),
      lng: Number(d.lng.toFixed(4)),
      distanceKm: Number(d.distanceKm.toFixed(2)),
    }));
  }
}

@Module({
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
