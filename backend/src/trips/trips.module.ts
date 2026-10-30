import { Body, Controller, Get, Injectable, Logger, Module, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth.js';
import type { AuthUser } from '../common/types.js';
import { DriversModule } from '../drivers/drivers.module.js';
import { DriversService } from '../drivers/drivers.service.js';
import { Role } from '../generated/prisma/client.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { CancelTripDto, CreateTripDto, EstimateTripDto, OfferDto, PaginationDto, RateTripDto } from './trips.dto.js';
import { TripsService } from './trips.service.js';

const UUID = new ParseUUIDPipe();

@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  // ----- Pasajero -----

  @Post('estimate')
  estimate(@Body() dto: EstimateTripDto) {
    return this.trips.estimate(dto);
  }

  @Roles(Role.PASSENGER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTripDto) {
    return this.trips.create(user.userId, dto);
  }

  @Roles(Role.PASSENGER)
  @Get(':id/offers')
  offers(@Param('id', UUID) id: string, @CurrentUser() user: AuthUser) {
    return this.trips.listOffers(id, user.userId);
  }

  @Roles(Role.PASSENGER)
  @Post(':id/offers/:offerId/accept')
  acceptOffer(
    @Param('id', UUID) id: string,
    @Param('offerId', UUID) offerId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trips.acceptOffer(id, offerId, user.userId);
  }

  @Roles(Role.PASSENGER)
  @Post(':id/offers/:offerId/reject')
  rejectOffer(
    @Param('id', UUID) id: string,
    @Param('offerId', UUID) offerId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trips.rejectOffer(id, offerId, user.userId);
  }

  // ----- Conductor -----

  @Roles(Role.DRIVER)
  @Get('available')
  available(@CurrentUser() user: AuthUser) {
    return this.trips.available(user.driverId!);
  }

  @Roles(Role.DRIVER)
  @Post(':id/accept')
  accept(@Param('id', UUID) id: string, @CurrentUser() user: AuthUser) {
    return this.trips.accept(id, user.driverId!);
  }

  @Roles(Role.DRIVER)
  @Post(':id/offers')
  makeOffer(@Param('id', UUID) id: string, @CurrentUser() user: AuthUser, @Body() dto: OfferDto) {
    return this.trips.makeOffer(id, user.driverId!, dto.amount);
  }

  @Roles(Role.DRIVER)
  @Post(':id/arrive')
  arrive(@Param('id', UUID) id: string, @CurrentUser() user: AuthUser) {
    return this.trips.arrive(id, user.driverId!);
  }

  @Roles(Role.DRIVER)
  @Post(':id/start')
  start(@Param('id', UUID) id: string, @CurrentUser() user: AuthUser) {
    return this.trips.start(id, user.driverId!);
  }

  @Roles(Role.DRIVER)
  @Post(':id/complete')
  complete(@Param('id', UUID) id: string, @CurrentUser() user: AuthUser) {
    return this.trips.complete(id, user.driverId!);
  }

  // ----- Ambos -----

  @Get('active')
  active(@CurrentUser() user: AuthUser) {
    return this.trips.active(user);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.trips.history(user, q);
  }

  @Get(':id')
  findOne(@Param('id', UUID) id: string, @CurrentUser() user: AuthUser) {
    return this.trips.findOne(id, user);
  }

  @Post(':id/cancel')
  cancel(@Param('id', UUID) id: string, @CurrentUser() user: AuthUser, @Body() dto: CancelTripDto) {
    return this.trips.cancel(id, user, dto);
  }

  @Post(':id/rate')
  rate(@Param('id', UUID) id: string, @CurrentUser() user: AuthUser, @Body() dto: RateTripDto) {
    return this.trips.rate(id, user, dto.rating);
  }
}

/** Tareas periódicas */
@Injectable()
export class TripsScheduler {
  private readonly logger = new Logger(TripsScheduler.name);

  constructor(
    private readonly trips: TripsService,
    private readonly drivers: DriversService,
  ) {}

  @Interval(30_000)
  async expireRequests() {
    try {
      const n = await this.trips.expireStaleRequests();
      if (n) this.logger.log(`${n} solicitud(es) expirada(s) sin conductor`);
    } catch (e) {
      this.logger.error(`expireRequests: ${(e as Error).message}`);
    }
  }

  @Interval(60_000)
  async purgeDrivers() {
    try {
      const n = await this.drivers.purgeStale();
      if (n) this.logger.log(`${n} conductor(es) sin señal removidos del mapa`);
    } catch (e) {
      this.logger.error(`purgeDrivers: ${(e as Error).message}`);
    }
  }
}

@Module({
  imports: [DriversModule, RealtimeModule],
  controllers: [TripsController],
  providers: [TripsService, TripsScheduler],
  exports: [TripsService],
})
export class TripsModule {}
