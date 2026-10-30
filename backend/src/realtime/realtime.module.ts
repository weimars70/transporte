import { Logger, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { toPlain } from '../common/serialize.js';
import type { AuthUser, JwtPayload } from '../common/types.js';
import { DriversModule } from '../drivers/drivers.module.js';
import { DriversService } from '../drivers/drivers.service.js';
import { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';

type AppSocket = Socket & { data: { user?: AuthUser } };

/** Salas de Socket.IO */
export const Rooms = {
  user: (userId: string) => `user:${userId}`,
  driver: (driverId: string) => `driver:${driverId}`,
  trip: (tripId: string) => `trip:${tripId}`,
  admins: 'admins',
};

/**
 * Eventos servidor -> cliente
 *  - trip:new          (conductor)  nueva solicitud de viaje cercana
 *  - trip:unavailable  (conductor)  la solicitud ya fue tomada/cancelada
 *  - trip:offer        (pasajero)   un conductor hizo una oferta (modo BIDDING)
 *  - trip:updated      (ambos)      cambio de estado del viaje
 *  - driver:location   (pasajero)   ubicación del conductor asignado
 *  - admin:driver-location (admin)  ubicación de cualquier conductor
 *
 * Eventos cliente -> servidor
 *  - driver:location {lat,lng,heading?}  (conductor, cada 3-5 s)
 *  - trip:join {tripId}                  (re-suscribirse tras reconexión)
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly drivers: DriversService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AppSocket) {
    const authHeader = client.handshake.headers.authorization;
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

    try {
      if (!token) throw new Error('sin token');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const user: AuthUser = { userId: payload.sub, role: payload.role, driverId: payload.driverId };
      client.data.user = user;

      await client.join(Rooms.user(user.userId));
      if (user.driverId) await client.join(Rooms.driver(user.driverId));
      if (user.role === Role.ADMIN) await client.join(Rooms.admins);

      client.emit('connected', { userId: user.userId, role: user.role });
    } catch {
      client.emit('unauthorized', { message: 'Token inválido' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('driver:location')
  async onDriverLocation(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { lat: number; lng: number; heading?: number },
  ) {
    const user = client.data.user;
    if (!user?.driverId) return { ok: false, error: 'No eres conductor' };

    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { ok: false, error: 'Coordenadas inválidas' };
    }
    const heading = body.heading !== undefined ? Number(body.heading) : undefined;

    const { accepted, activeTripId } = await this.drivers.updateLocation(user.driverId, lat, lng, heading);
    const point = { driverId: user.driverId, lat, lng, heading, ts: Date.now() };

    if (activeTripId) {
      this.server.to(Rooms.trip(activeTripId)).emit('driver:location', { ...point, tripId: activeTripId });
    }
    this.server.to(Rooms.admins).emit('admin:driver-location', { ...point, busy: !!activeTripId });

    return { ok: accepted, activeTripId };
  }

  @SubscribeMessage('trip:join')
  async onTripJoin(@ConnectedSocket() client: AppSocket, @MessageBody() body: { tripId: string }) {
    const user = client.data.user;
    if (!user || !body?.tripId) return { ok: false };

    const trip = await this.prisma.trip.findUnique({
      where: { id: body.tripId },
      select: { passengerId: true, driverId: true },
    });
    const allowed =
      !!trip &&
      (trip.passengerId === user.userId ||
        (!!user.driverId && trip.driverId === user.driverId) ||
        user.role === Role.ADMIN);
    if (!allowed) return { ok: false, error: 'Sin acceso al viaje' };

    await client.join(Rooms.trip(body.tripId));
    return { ok: true };
  }

  // ---------- Helpers usados por los servicios ----------

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(Rooms.user(userId)).emit(event, toPlain(data));
  }

  emitToDriver(driverId: string, event: string, data: unknown) {
    this.server.to(Rooms.driver(driverId)).emit(event, toPlain(data));
  }

  emitToDrivers(driverIds: string[], event: string, data: unknown) {
    if (driverIds.length === 0) return;
    this.server.to(driverIds.map(Rooms.driver)).emit(event, toPlain(data));
  }

  emitToTrip(tripId: string, event: string, data: unknown) {
    this.server.to(Rooms.trip(tripId)).emit(event, toPlain(data));
  }

  emitToAdmins(event: string, data: unknown) {
    this.server.to(Rooms.admins).emit(event, toPlain(data));
  }

  /** Mete a pasajero y conductor en la sala del viaje */
  joinTrip(tripId: string, passengerId: string, driverId: string) {
    this.server.in(Rooms.user(passengerId)).socketsJoin(Rooms.trip(tripId));
    this.server.in(Rooms.driver(driverId)).socketsJoin(Rooms.trip(tripId));
  }

  closeTrip(tripId: string) {
    this.server.in(Rooms.trip(tripId)).socketsLeave(Rooms.trip(tripId));
  }
}

@Module({
  imports: [DriversModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
