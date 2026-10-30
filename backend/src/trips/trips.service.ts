import * as bcrypt from 'bcryptjs';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { estimateEtaSeconds, haversineKm } from '../common/geo.js';
import type { AuthUser } from '../common/types.js';
import { DriversService } from '../drivers/drivers.service.js';
import {
  DriverStatus,
  OfferStatus,
  PaymentMethod,
  Prisma,
  PricingMode,
  Role,
  TripStatus,
  VehicleType,
} from '../generated/prisma/client.js';
import { MapsService, PricingService } from '../pricing/pricing.module.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { RealtimeGateway } from '../realtime/realtime.module.js';
import { RedisService } from '../redis/redis.module.js';
import {
  CancelTripDto,
  CreateAdminTripDto,
  CreateTripDto,
  EstimateTripDto,
  PaginationDto,
} from './trips.dto.js';

const ACTIVE_STATUSES: TripStatus[] = [
  TripStatus.REQUESTED,
  TripStatus.ACCEPTED,
  TripStatus.ARRIVED,
  TripStatus.IN_PROGRESS,
];

/** Relaciones que se envían a los clientes */
export const tripInclude = {
  passenger: { select: { id: true, name: true, phone: true, rating: true, avatarUrl: true } },
  driver: {
    select: {
      id: true,
      totalTrips: true,
      lastLat: true,
      lastLng: true,
      user: { select: { id: true, name: true, phone: true, rating: true, avatarUrl: true } },
      vehicle: true,
    },
  },
} satisfies Prisma.TripInclude;

/** Conductores que recibieron la solicitud (para avisarles si ya no está disponible) */
const recipientsKey = (tripId: string) => `trip:recipients:${tripId}`;

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);
  private readonly memoryRecipients = new Map<string, string[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly drivers: DriversService,
    private readonly maps: MapsService,
    private readonly pricing: PricingService,
    private readonly realtime: RealtimeGateway,
    private readonly config: ConfigService,
  ) {}

  private get radiusKm() {
    return Number(this.config.get('SEARCH_RADIUS_KM') ?? 5);
  }

  // =========================================================
  //  PASAJERO
  // =========================================================

  async estimate(dto: EstimateTripDto) {
    const type = dto.vehicleType ?? VehicleType.CAR;
    const origin = { lat: dto.originLat, lng: dto.originLng };
    const [route, setting, nearby] = await Promise.all([
      this.maps.route(origin, { lat: dto.destLat, lng: dto.destLng }),
      this.pricing.getSetting(type),
      this.drivers.findNearby(origin.lat, origin.lng, type, this.radiusKm),
    ]);
    const estimatedFare = this.pricing.calculate(setting, route.distanceMeters, route.durationSeconds);

    return {
      vehicleType: type,
      ...route,
      estimatedFare,
      currency: setting.currency,
      biddingEnabled: setting.biddingEnabled,
      minBid: this.pricing.minBid(setting, estimatedFare),
      nearbyDrivers: nearby.length,
      pickupEtaSeconds: nearby[0] ? estimateEtaSeconds(nearby[0].distanceKm) : null,
    };
  }

  async create(passengerId: string, dto: CreateTripDto) {
    const active = await this.prisma.trip.findFirst({
      where: { passengerId, status: { in: ACTIVE_STATUSES } },
      select: { id: true },
    });
    if (active) throw new ConflictException('Ya tienes un viaje activo');

    // Siempre recalculamos en el servidor: nunca confiar en la tarifa del cliente
    const est = await this.estimate(dto);
    const pricingMode = dto.pricingMode ?? PricingMode.FIXED;

    if (pricingMode === PricingMode.BIDDING) {
      if (!est.biddingEnabled) throw new BadRequestException('Las ofertas no están habilitadas');
      if (!dto.proposedFare) throw new BadRequestException('Debes proponer un precio');
      if (dto.proposedFare < est.minBid) {
        throw new BadRequestException(`La oferta mínima es ${est.minBid} ${est.currency}`);
      }
    }

    const trip = await this.prisma.trip.create({
      data: {
        passengerId,
        pricingMode,
        vehicleType: est.vehicleType,
        payment: dto.payment,
        originLat: dto.originLat,
        originLng: dto.originLng,
        originAddress: dto.originAddress,
        destLat: dto.destLat,
        destLng: dto.destLng,
        destAddress: dto.destAddress,
        polyline: est.polyline,
        distanceMeters: est.distanceMeters,
        durationSeconds: est.durationSeconds,
        estimatedFare: est.estimatedFare,
        proposedFare: pricingMode === PricingMode.BIDDING ? dto.proposedFare : null,
        currency: est.currency,
      },
      include: tripInclude,
    });

    const notified = await this.dispatch(trip);
    this.realtime.emitToAdmins('admin:trip', trip);
    return { ...trip, notifiedDrivers: notified };
  }

  /** Envía la solicitud a los conductores disponibles más cercanos */
  private async dispatch(trip: Prisma.TripGetPayload<{ include: typeof tripInclude }>) {
    const nearby = await this.drivers.findNearby(
      trip.originLat,
      trip.originLng,
      trip.vehicleType,
      this.radiusKm,
    );
    if (nearby.length === 0) return 0;

    const { passenger, ...rest } = trip;
    for (const d of nearby) {
      this.realtime.emitToDriver(d.driverId, 'trip:new', {
        ...rest,
        passenger: { name: passenger.name, rating: passenger.rating },
        distanceToPickupKm: Number(d.distanceKm.toFixed(2)),
        pickupEtaSeconds: estimateEtaSeconds(d.distanceKm),
      });
    }

    const driverIds = nearby.map((d) => d.driverId);
    this.memoryRecipients.set(trip.id, driverIds);

    if (this.redis.isReady) {
      try {
        const key = recipientsKey(trip.id);
        await this.redis.client.sadd(key, ...driverIds);
        await this.redis.client.expire(key, 3600);
      } catch {}
    }
    return nearby.length;
  }

  async listOffers(tripId: string, passengerId: string) {
    const trip = await this.getTripOrThrow(tripId);
    if (trip.passengerId !== passengerId) throw new ForbiddenException();
    return this.prisma.tripOffer.findMany({
      where: { tripId, status: OfferStatus.PENDING },
      include: {
        driver: {
          select: {
            id: true,
            totalTrips: true,
            user: { select: { name: true, rating: true, avatarUrl: true } },
            vehicle: true,
          },
        },
      },
      orderBy: { amount: 'asc' },
    });
  }

  /** El pasajero acepta la oferta de un conductor (modo BIDDING) */
  async acceptOffer(tripId: string, offerId: string, passengerId: string) {
    const offer = await this.prisma.tripOffer.findUnique({ where: { id: offerId }, include: { trip: true } });
    if (!offer || offer.tripId !== tripId) throw new NotFoundException('Oferta no encontrada');
    if (offer.trip.passengerId !== passengerId) throw new ForbiddenException();
    if (offer.status !== OfferStatus.PENDING) throw new ConflictException('La oferta ya no está vigente');
    if (await this.drivers.getActiveTripId(offer.driverId)) {
      throw new ConflictException('El conductor ya tomó otro viaje');
    }

    const res = await this.prisma.trip.updateMany({
      where: { id: tripId, status: TripStatus.REQUESTED, driverId: null },
      data: {
        status: TripStatus.ACCEPTED,
        driverId: offer.driverId,
        finalFare: offer.amount,
        acceptedAt: new Date(),
      },
    });
    if (res.count === 0) throw new ConflictException('El viaje ya no está disponible');

    return this.onDriverAssigned(tripId, offer.driverId, offerId);
  }

  async rejectOffer(tripId: string, offerId: string, passengerId: string) {
    const trip = await this.getTripOrThrow(tripId);
    if (trip.passengerId !== passengerId) throw new ForbiddenException();
    const offer = await this.prisma.tripOffer.update({
      where: { id: offerId, tripId },
      data: { status: OfferStatus.REJECTED },
    });
    this.realtime.emitToDriver(offer.driverId, 'trip:offer-rejected', { tripId, offerId });
    return { ok: true };
  }

  // =========================================================
  //  CONDUCTOR
  // =========================================================

  /** Solicitudes cercanas pendientes (por si el conductor no recibió el socket) */
  async available(driverId: string) {
    const [driver, pos] = await Promise.all([
      this.getApprovedDriver(driverId),
      this.drivers.getPosition(driverId),
    ]);
    if (!pos) return [];

    const since = new Date(Date.now() - 15 * 60 * 1000);
    const trips = await this.prisma.trip.findMany({
      where: { status: TripStatus.REQUESTED, vehicleType: driver.vehicle!.type, requestedAt: { gte: since } },
      include: { passenger: { select: { name: true, rating: true } } },
      orderBy: { requestedAt: 'desc' },
      take: 50,
    });
    return trips
      .map((t) => {
        const km = haversineKm(pos, { lat: t.originLat, lng: t.originLng });
        return { ...t, distanceToPickupKm: Number(km.toFixed(2)), pickupEtaSeconds: estimateEtaSeconds(km) };
      })
      .filter((t) => t.distanceToPickupKm <= this.radiusKm)
      .sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);
  }

  /** El conductor acepta el viaje al precio actual (fijo o el propuesto por el pasajero) */
  async accept(tripId: string, driverId: string) {
    const driver = await this.getApprovedDriver(driverId);
    if (await this.drivers.getActiveTripId(driverId)) throw new ConflictException('Ya tienes un viaje activo');

    const trip = await this.getTripOrThrow(tripId);
    if (trip.vehicleType !== driver.vehicle!.type) throw new ForbiddenException('Tipo de vehículo distinto');
    const fare = trip.pricingMode === PricingMode.BIDDING ? trip.proposedFare : trip.estimatedFare;

    const res = await this.prisma.trip.updateMany({
      where: { id: tripId, status: TripStatus.REQUESTED, driverId: null },
      data: { status: TripStatus.ACCEPTED, driverId, finalFare: fare, acceptedAt: new Date() },
    });
    if (res.count === 0) throw new ConflictException('El viaje ya fue tomado por otro conductor');

    return this.onDriverAssigned(tripId, driverId);
  }

  /** El conductor contraoferta un precio (modo BIDDING) */
  async makeOffer(tripId: string, driverId: string, amount: number) {
    const driver = await this.getApprovedDriver(driverId);
    if (await this.drivers.getActiveTripId(driverId)) throw new ConflictException('Ya tienes un viaje activo');

    const trip = await this.getTripOrThrow(tripId);
    if (trip.status !== TripStatus.REQUESTED) throw new ConflictException('El viaje ya no está disponible');
    if (trip.pricingMode !== PricingMode.BIDDING) throw new BadRequestException('Este viaje es de tarifa fija');
    if (trip.vehicleType !== driver.vehicle!.type) throw new ForbiddenException('Tipo de vehículo distinto');

    const max = trip.estimatedFare.toNumber() * 2;
    if (amount < trip.proposedFare!.toNumber() || amount > max) {
      throw new BadRequestException(`La oferta debe estar entre ${trip.proposedFare} y ${max.toFixed(2)}`);
    }

    const pos = await this.drivers.getPosition(driverId);
    const etaSeconds = pos
      ? estimateEtaSeconds(haversineKm(pos, { lat: trip.originLat, lng: trip.originLng }))
      : null;

    const offer = await this.prisma.tripOffer.upsert({
      where: { tripId_driverId: { tripId, driverId } },
      create: { tripId, driverId, amount, etaSeconds },
      update: { amount, etaSeconds, status: OfferStatus.PENDING, createdAt: new Date() },
      include: {
        driver: {
          select: {
            id: true,
            totalTrips: true,
            user: { select: { name: true, rating: true, avatarUrl: true } },
            vehicle: true,
          },
        },
      },
    });
    this.realtime.emitToUser(trip.passengerId, 'trip:offer', offer);
    return offer;
  }

  async arrive(tripId: string, driverId: string) {
    return this.transition(tripId, driverId, TripStatus.ACCEPTED, TripStatus.ARRIVED, { arrivedAt: new Date() });
  }

  async start(tripId: string, driverId: string) {
    return this.transition(tripId, driverId, TripStatus.ARRIVED, TripStatus.IN_PROGRESS, {
      startedAt: new Date(),
    });
  }

  async complete(tripId: string, driverId: string) {
    const trip = await this.transition(tripId, driverId, TripStatus.IN_PROGRESS, TripStatus.COMPLETED, {
      completedAt: new Date(),
    });
    await this.prisma.driver.update({ where: { id: driverId }, data: { totalTrips: { increment: 1 } } });
    await this.drivers.clearBusy(driverId);
    this.realtime.closeTrip(tripId);
    return trip;
  }

  // =========================================================
  //  AMBOS
  // =========================================================

  async cancel(tripId: string, user: AuthUser, dto: CancelTripDto) {
    const trip = await this.getTripOrThrow(tripId);
    const isPassenger = trip.passengerId === user.userId;
    const isDriver = !!user.driverId && trip.driverId === user.driverId;
    if (!isPassenger && !isDriver && user.role !== Role.ADMIN) throw new ForbiddenException();

    const cancellable: TripStatus[] = isDriver
      ? [TripStatus.ACCEPTED, TripStatus.ARRIVED]
      : [TripStatus.REQUESTED, TripStatus.ACCEPTED, TripStatus.ARRIVED];
    if (!cancellable.includes(trip.status)) {
      throw new ConflictException('El viaje no se puede cancelar en su estado actual');
    }

    const res = await this.prisma.trip.updateMany({
      where: { id: tripId, status: trip.status },
      data: {
        status: TripStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: isPassenger ? Role.PASSENGER : isDriver ? Role.DRIVER : Role.ADMIN,
        cancelReason: dto.reason,
      },
    });
    if (res.count === 0) throw new ConflictException('El estado del viaje cambió, intenta de nuevo');

    return this.finishCancelled(tripId);
  }

  /** Cancela automáticamente solicitudes sin conductor tras el timeout */
  async expireStaleRequests() {
    const minutes = Number(this.config.get('TRIP_REQUEST_TIMEOUT_MIN') ?? 3);
    const limit = new Date(Date.now() - minutes * 60 * 1000);
    const stale = await this.prisma.trip.findMany({
      where: { status: TripStatus.REQUESTED, requestedAt: { lt: limit } },
      select: { id: true },
    });
    for (const { id } of stale) {
      const res = await this.prisma.trip.updateMany({
        where: { id, status: TripStatus.REQUESTED },
        data: { status: TripStatus.CANCELLED, cancelledAt: new Date(), cancelReason: 'NO_DRIVERS' },
      });
      if (res.count) await this.finishCancelled(id);
    }
    return stale.length;
  }

  async rate(tripId: string, user: AuthUser, rating: number) {
    const trip = await this.getTripOrThrow(tripId);
    if (trip.status !== TripStatus.COMPLETED) throw new ConflictException('Solo puedes calificar viajes completados');

    if (trip.passengerId === user.userId) {
      if (trip.ratingByPassenger) throw new ConflictException('Ya calificaste este viaje');
      const driver = await this.prisma.driver.findUniqueOrThrow({ where: { id: trip.driverId! } });
      await this.prisma.$transaction([
        this.prisma.trip.update({ where: { id: tripId }, data: { ratingByPassenger: rating } }),
        this.applyRating(driver.userId, rating),
      ]);
    } else if (user.driverId && trip.driverId === user.driverId) {
      if (trip.ratingByDriver) throw new ConflictException('Ya calificaste este viaje');
      await this.prisma.$transaction([
        this.prisma.trip.update({ where: { id: tripId }, data: { ratingByDriver: rating } }),
        this.applyRating(trip.passengerId, rating),
      ]);
    } else {
      throw new ForbiddenException();
    }
    return { ok: true };
  }

  /** Viaje en curso del usuario (para restaurar la app al abrirla) */
  async active(user: AuthUser) {
    const where: Prisma.TripWhereInput =
      user.role === Role.DRIVER && user.driverId
        ? { driverId: user.driverId, status: { in: ACTIVE_STATUSES } }
        : { passengerId: user.userId, status: { in: ACTIVE_STATUSES } };
    return this.prisma.trip.findFirst({ where, include: tripInclude, orderBy: { requestedAt: 'desc' } });
  }

  async history(user: AuthUser, { page, pageSize }: PaginationDto) {
    const where: Prisma.TripWhereInput =
      user.role === Role.DRIVER && user.driverId ? { driverId: user.driverId } : { passengerId: user.userId };
    const [items, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: tripInclude,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.trip.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(tripId: string, user: AuthUser) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId }, include: tripInclude });
    if (!trip) throw new NotFoundException('Viaje no encontrado');
    const allowed =
      user.role === Role.ADMIN ||
      trip.passengerId === user.userId ||
      (!!user.driverId && trip.driverId === user.driverId);
    if (!allowed) throw new ForbiddenException();
    return trip;
  }

  // =========================================================
  //  ADMINISTRADOR
  // =========================================================

  async assignDriverByAdmin(tripId: string, driverId: string) {
    const driver = await this.getApprovedDriver(driverId);
    if (await this.drivers.getActiveTripId(driverId)) {
      throw new ConflictException('El conductor seleccionado ya tiene un viaje activo');
    }

    const trip = await this.getTripOrThrow(tripId);
    if (trip.status !== TripStatus.REQUESTED) {
      throw new ConflictException(`Solo se pueden asignar viajes en estado REQUESTED (actual: ${trip.status})`);
    }

    const fare = trip.finalFare ?? trip.proposedFare ?? trip.estimatedFare;

    await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: TripStatus.ACCEPTED,
        driverId,
        finalFare: fare,
        acceptedAt: new Date(),
      },
    });

    return this.onDriverAssigned(tripId, driverId);
  }

  async createAdminTrip(dto: CreateAdminTripDto) {
    // 1. Buscar o registrar pasajero automáticamente
    let passenger = await this.prisma.user.findUnique({
      where: { phone: dto.passengerPhone },
    });

    if (!passenger) {
      const hash = await bcrypt.hash('123456', 10);
      passenger = await this.prisma.user.create({
        data: {
          name: dto.passengerName,
          phone: dto.passengerPhone,
          passwordHash: hash,
          role: Role.PASSENGER,
        },
      });
    }

    // 2. Geocodificar direcciones automáticamente si no se enviaron coordenadas explícitas
    const originCoords =
      typeof dto.originLat === 'number' && typeof dto.originLng === 'number'
        ? { lat: dto.originLat, lng: dto.originLng }
        : await this.maps.geocode(dto.originAddress, { lat: -17.7833, lng: -63.1821 });

    const destCoords =
      typeof dto.destLat === 'number' && typeof dto.destLng === 'number'
        ? { lat: dto.destLat, lng: dto.destLng }
        : await this.maps.geocode(dto.destAddress, { lat: -17.7550, lng: -63.1990 });

    // 3. Calcular ruta y distancia
    let distanceMeters = 3000;
    let durationSeconds = 600;
    let polyline: string | null = null;
    try {
      const route = await this.maps.route(originCoords, destCoords);
      distanceMeters = route.distanceMeters;
      durationSeconds = route.durationSeconds;
      polyline = route.polyline;
    } catch {
      const km = haversineKm(originCoords, destCoords);
      distanceMeters = Math.max(500, Math.round(km * 1000));
      durationSeconds = Math.max(120, estimateEtaSeconds(km));
    }

    const type = dto.vehicleType ?? VehicleType.CAR;
    const setting = await this.pricing.getSetting(type);
    const calculatedFare = this.pricing.calculate(setting, distanceMeters, durationSeconds);
    const fare = dto.fare && dto.fare > 0 ? dto.fare : calculatedFare;

    // 4. Si se especificó conductor de una vez, validar
    let driverIdToAssign: string | null = null;
    if (dto.driverId) {
      await this.getApprovedDriver(dto.driverId);
      if (await this.drivers.getActiveTripId(dto.driverId)) {
        throw new ConflictException('El conductor seleccionado ya tiene un viaje activo');
      }
      driverIdToAssign = dto.driverId;
    }

    // 5. Crear viaje
    const trip = await this.prisma.trip.create({
      data: {
        passengerId: passenger.id,
        driverId: driverIdToAssign,
        status: driverIdToAssign ? TripStatus.ACCEPTED : TripStatus.REQUESTED,
        pricingMode: PricingMode.FIXED,
        vehicleType: type,
        payment: dto.payment ?? PaymentMethod.CASH,
        originLat: originCoords.lat,
        originLng: originCoords.lng,
        originAddress: dto.originAddress,
        destLat: destCoords.lat,
        destLng: destCoords.lng,
        destAddress: dto.destAddress,
        polyline,
        distanceMeters,
        durationSeconds,
        estimatedFare: fare,
        finalFare: driverIdToAssign ? fare : null,
        currency: setting.currency,
        acceptedAt: driverIdToAssign ? new Date() : null,
      },
      include: tripInclude,
    });

    if (driverIdToAssign) {
      return this.onDriverAssigned(trip.id, driverIdToAssign);
    } else {
      const notified = await this.dispatch(trip);
      this.realtime.emitToAdmins('admin:trip', trip);
      return { ...trip, notifiedDrivers: notified };
    }
  }

  // =========================================================
  //  Internos
  // =========================================================

  private async onDriverAssigned(tripId: string, driverId: string, acceptedOfferId?: string) {
    await this.drivers.setBusy(driverId, tripId);
    await this.prisma.tripOffer.updateMany({
      where: { tripId, status: OfferStatus.PENDING, ...(acceptedOfferId ? { id: { not: acceptedOfferId } } : {}) },
      data: { status: OfferStatus.REJECTED },
    });
    if (acceptedOfferId) {
      await this.prisma.tripOffer.update({ where: { id: acceptedOfferId }, data: { status: OfferStatus.ACCEPTED } });
    }

    const trip = await this.prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: tripInclude });
    this.realtime.joinTrip(tripId, trip.passengerId, driverId);
    this.realtime.emitToTrip(tripId, 'trip:updated', trip);
    this.realtime.emitToUser(trip.passengerId, 'trip:updated', trip);
    this.realtime.emitToDriver(driverId, 'trip:updated', trip);
    this.realtime.emitToAdmins('admin:trip', trip);
    await this.notifyUnavailable(tripId, driverId);
    return trip;
  }

  private async finishCancelled(tripId: string) {
    const trip = await this.prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: tripInclude });
    await this.prisma.tripOffer.updateMany({
      where: { tripId, status: OfferStatus.PENDING },
      data: { status: OfferStatus.EXPIRED },
    });
    if (trip.driverId) {
      await this.drivers.clearBusy(trip.driverId);
      this.realtime.emitToDriver(trip.driverId, 'trip:updated', trip);
    }
    this.realtime.emitToUser(trip.passengerId, 'trip:updated', trip);
    this.realtime.emitToAdmins('admin:trip', trip);
    this.realtime.closeTrip(tripId);
    await this.notifyUnavailable(tripId);
    return trip;
  }

  /** Avisa a los conductores que recibieron la solicitud que ya no está disponible */
  private async notifyUnavailable(tripId: string, exceptDriverId?: string) {
    let ids: string[] = [];
    if (this.redis.isReady) {
      try {
        const key = recipientsKey(tripId);
        ids = (await this.redis.client.smembers(key)).filter((id) => id !== exceptDriverId);
        await this.redis.client.del(key);
      } catch {}
    }

    if (ids.length === 0) {
      const mem = this.memoryRecipients.get(tripId) ?? [];
      ids = mem.filter((id) => id !== exceptDriverId);
    }
    this.memoryRecipients.delete(tripId);

    this.realtime.emitToDrivers(ids, 'trip:unavailable', { tripId });
  }

  private async transition(
    tripId: string,
    driverId: string,
    from: TripStatus,
    to: TripStatus,
    data: Prisma.TripUpdateManyMutationInput,
  ) {
    const res = await this.prisma.trip.updateMany({
      where: { id: tripId, driverId, status: from },
      data: { ...data, status: to },
    });
    if (res.count === 0) throw new ConflictException(`El viaje debe estar en estado ${from}`);

    const trip = await this.prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: tripInclude });
    this.realtime.emitToTrip(tripId, 'trip:updated', trip);
    this.realtime.emitToUser(trip.passengerId, 'trip:updated', trip);
    this.realtime.emitToAdmins('admin:trip', trip);
    return trip;
  }

  private applyRating(userId: string, rating: number) {
    // promedio incremental: nuevo = (actual * n + r) / (n + 1)
    return this.prisma.$executeRaw`
      UPDATE "User"
      SET "rating" = ("rating" * "ratingCount" + ${rating}) / ("ratingCount" + 1),
          "ratingCount" = "ratingCount" + 1
      WHERE "id" = ${userId}`;
  }

  private async getTripOrThrow(tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viaje no encontrado');
    return trip;
  }

  private async getApprovedDriver(driverId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId }, include: { vehicle: true } });
    if (!driver) throw new NotFoundException('Conductor no encontrado');
    if (driver.status !== DriverStatus.APPROVED) throw new ForbiddenException('Tu cuenta no está aprobada');
    if (!driver.vehicle) throw new BadRequestException('No tienes vehículo registrado');
    return driver;
  }
}
