import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth.js';
import { DriversService } from '../drivers/drivers.service.js';
import {
  DriverStatus,
  Prisma,
  Role,
  TripStatus,
  VehicleType,
} from '../generated/prisma/client.js';
import { DriversModule } from '../drivers/drivers.module.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { RealtimeGateway, RealtimeModule } from '../realtime/realtime.module.js';
import { AssignDriverDto, CreateAdminTripDto } from '../trips/trips.dto.js';
import { TripsModule } from '../trips/trips.module.js';
import { TripsService, tripInclude } from '../trips/trips.service.js';

const UUID = new ParseUUIDPipe();

class UpdateDriverStatusDto {
  @IsEnum(DriverStatus)
  status: DriverStatus;
}

class UpdateFareSettingDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseFare: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  perKm: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  perMinute: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumFare: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bookingFee: number;

  @IsBoolean()
  biddingEnabled: boolean;

  @IsInt()
  @Min(10)
  @Max(100)
  minBidPercent: number;

  @IsInt()
  @Min(0)
  @Max(50)
  commissionPct: number;
}

class AdminTripsQueryDto {
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

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

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drivers: DriversService,
    private readonly realtime: RealtimeGateway,
    private readonly trips: TripsService,
  ) {}

  /** Métricas y estadísticas para el dashboard */
  @Get('dashboard')
  async dashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalTrips,
      todayTrips,
      completedTrips,
      totalDrivers,
      pendingDrivers,
      totalPassengers,
      todayRevenueAgg,
    ] = await Promise.all([
      this.prisma.trip.count(),
      this.prisma.trip.count({ where: { requestedAt: { gte: today } } }),
      this.prisma.trip.count({ where: { status: TripStatus.COMPLETED } }),
      this.prisma.driver.count(),
      this.prisma.driver.count({ where: { status: DriverStatus.PENDING } }),
      this.prisma.user.count({ where: { role: Role.PASSENGER } }),
      this.prisma.trip.aggregate({
        where: { status: TripStatus.COMPLETED, completedAt: { gte: today } },
        _sum: { finalFare: true },
      }),
    ]);

    const activePositions = await this.drivers.getAllPositions();

    return {
      trips: {
        total: totalTrips,
        today: todayTrips,
        completed: completedTrips,
      },
      drivers: {
        total: totalDrivers,
        pendingApproval: pendingDrivers,
        onlineNow: activePositions.filter((p) => !p.busy).length,
        busyNow: activePositions.filter((p) => p.busy).length,
      },
      passengers: {
        total: totalPassengers,
      },
      revenue: {
        today: todayRevenueAgg._sum.finalFare ?? 0,
      },
    };
  }

  /** Posiciones en vivo de todos los conductores para el mapa del Admin */
  @Get('drivers/live-positions')
  livePositions() {
    return this.drivers.getAllPositions();
  }

  /** Listar conductores registrados con filtros */
  @Get('drivers')
  async listDrivers(
    @Query('status') status?: DriverStatus,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const where: Prisma.DriverWhereInput = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true, rating: true, avatarUrl: true, isActive: true } },
          vehicle: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.driver.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
  }

  /** Aprobar, rechazar o suspender un conductor */
  @Patch('drivers/:id/status')
  async updateDriverStatus(
    @Param('id', UUID) id: string,
    @Body() dto: UpdateDriverStatusDto,
  ) {
    const driver = await this.prisma.driver.update({
      where: { id },
      data: { status: dto.status },
      include: { user: true, vehicle: true },
    });

    if (dto.status !== DriverStatus.APPROVED) {
      await this.drivers.setOnline(id, false).catch(() => {});
    }

    this.realtime.emitToUser(driver.userId, 'driver:status-changed', {
      status: driver.status,
    });

    return driver;
  }

  /** Configuración de tarifas */
  @Get('fare-settings')
  getFareSettings() {
    return this.prisma.fareSetting.findMany({
      orderBy: { vehicleType: 'asc' },
    });
  }

  @Put('fare-settings/:type')
  async updateFareSetting(
    @Param('type') type: VehicleType,
    @Body() dto: UpdateFareSettingDto,
  ) {
    if (!Object.values(VehicleType).includes(type)) {
      throw new BadRequestException('Tipo de vehículo no válido');
    }

    return this.prisma.fareSetting.upsert({
      where: { vehicleType: type },
      create: {
        vehicleType: type,
        ...dto,
      },
      update: {
        ...dto,
      },
    });
  }

  /** Listado global de viajes */
  @Get('trips')
  async listTrips(@Query() q: AdminTripsQueryDto) {
    const where: Prisma.TripWhereInput = q.status ? { status: q.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: tripInclude,
        orderBy: { requestedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  /** Crear/Programar un servicio manualmente desde Admin */
  @Post('trips')
  async createTrip(@Body() dto: CreateAdminTripDto) {
    return this.trips.createAdminTrip(dto);
  }

  /** Asignar manualmente un conductor a un viaje */
  @Patch('trips/:id/assign')
  async assignDriver(
    @Param('id', UUID) id: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.trips.assignDriverByAdmin(id, dto.driverId);
  }
}

@Module({
  imports: [DriversModule, RealtimeModule, TripsModule],
  controllers: [AdminController],
})
export class AdminModule {}
