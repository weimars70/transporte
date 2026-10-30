import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { haversineKm } from '../common/geo.js';
import { DriverStatus, VehicleType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { RedisService } from '../redis/redis.module.js';

/** Claves Redis */
const K = {
  /** GEO set con conductores DISPONIBLES por tipo de vehículo */
  geo: (type: VehicleType) => `geo:drivers:${type}`,
  /** heartbeat del conductor (expira si deja de enviar ubicación) */
  hb: (driverId: string) => `driver:hb:${driverId}`,
  /** viaje activo del conductor (si existe está ocupado) */
  trip: (driverId: string) => `driver:trip:${driverId}`,
  /** última posición conocida de todos los conductores (para el mapa admin) */
  positions: 'driver:positions',
  /** throttle para persistir la posición en Postgres */
  persist: (driverId: string) => `driver:persist:${driverId}`,
};

const HEARTBEAT_TTL_SEC = 60;
const PERSIST_EVERY_SEC = 30;

export interface DriverPosition {
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  type: VehicleType;
  busy: boolean;
  ts: number;
}

export interface NearbyDriver {
  driverId: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  // Fallback en memoria cuando Redis no está activo
  private readonly memoryPositions = new Map<string, DriverPosition>();
  private readonly memoryBusy = new Map<string, string>(); // driverId -> tripId
  private readonly memoryHeartbeats = new Map<string, { type: VehicleType; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private get r() {
    return this.redis.client;
  }

  async getProfile(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        vehicle: true,
        user: { select: { id: true, name: true, phone: true, rating: true, avatarUrl: true } },
      },
    });
    if (!driver) throw new NotFoundException('Conductor no encontrado');
    return driver;
  }

  /** Conectarse / desconectarse para recibir viajes */
  async setOnline(driverId: string, online: boolean) {
    const driver = await this.getProfile(driverId);
    if (online) {
      if (driver.status !== DriverStatus.APPROVED) {
        throw new ForbiddenException('Tu cuenta aún no ha sido aprobada');
      }
      if (!driver.vehicle) throw new BadRequestException('Debes registrar un vehículo');
    } else {
      await this.removeFromGeo(driverId);
      this.memoryHeartbeats.delete(driverId);
      this.memoryPositions.delete(driverId);
      if (this.redis.isReady) {
        await this.r.del(K.hb(driverId)).catch(() => {});
        await this.r.hdel(K.positions, driverId).catch(() => {});
      }
    }
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { isOnline: online, lastSeenAt: new Date() },
      include: { vehicle: true },
    });
  }

  /**
   * Procesa una actualización de GPS del conductor.
   * - Si está libre y online => se indexa (Redis GEO o Map en memoria)
   * - Si tiene viaje activo => solo se devuelve el tripId para reenviar la ubicación al pasajero
   */
  async updateLocation(driverId: string, lat: number, lng: number, heading?: number) {
    let type: VehicleType | null = null;

    if (this.redis.isReady) {
      type = (await this.r.get(K.hb(driverId)).catch(() => null)) as VehicleType | null;
    } else {
      const hb = this.memoryHeartbeats.get(driverId);
      if (hb && hb.expiresAt > Date.now()) type = hb.type;
    }

    if (!type) {
      const driver = await this.prisma.driver.findUnique({
        where: { id: driverId },
        select: { isOnline: true, status: true, vehicle: { select: { type: true } } },
      });
      if (!driver?.isOnline || driver.status !== DriverStatus.APPROVED || !driver.vehicle) {
        return { accepted: false, activeTripId: null as string | null };
      }
      type = driver.vehicle.type;
    }

    const activeTripId = await this.getActiveTripId(driverId);
    const busy = !!activeTripId;
    const position: DriverPosition = { driverId, lat, lng, heading, type, busy, ts: Date.now() };

    // 1. Guardar en memoria
    this.memoryPositions.set(driverId, position);
    this.memoryHeartbeats.set(driverId, { type, expiresAt: Date.now() + HEARTBEAT_TTL_SEC * 1000 });

    // 2. Guardar en Redis si está disponible
    if (this.redis.isReady) {
      try {
        const pipe = this.r.multi();
        pipe.set(K.hb(driverId), type, 'EX', HEARTBEAT_TTL_SEC);
        pipe.hset(K.positions, driverId, JSON.stringify(position));
        if (busy) pipe.zrem(K.geo(type), driverId);
        else pipe.geoadd(K.geo(type), lng, lat, driverId);
        await pipe.exec();
      } catch (err: any) {
        this.logger.warn(`Error en Redis updateLocation: ${err.message}`);
      }
    }

    // Persistir en Postgres periódicamente
    await this.prisma.driver
      .update({ where: { id: driverId }, data: { lastLat: lat, lastLng: lng, lastSeenAt: new Date() } })
      .catch((e: Error) => this.logger.warn(`No se pudo persistir posición: ${e.message}`));

    return { accepted: true, activeTripId };
  }

  /** Conductores disponibles cerca de un punto, ordenados por distancia */
  async findNearby(lat: number, lng: number, type: VehicleType, radiusKm: number, limit = 20) {
    if (this.redis.isReady) {
      try {
        const raw = (await this.r.geosearch(
          K.geo(type),
          'FROMLONLAT',
          lng,
          lat,
          'BYRADIUS',
          radiusKm,
          'km',
          'ASC',
          'COUNT',
          limit,
          'WITHDIST',
          'WITHCOORD',
        )) as [string, string, [string, string]][];

        if (raw.length > 0) {
          const alive = await this.r.mget(...raw.map(([id]) => K.hb(id)));
          const result: NearbyDriver[] = [];
          raw.forEach(([driverId, dist, [lon, la]], i) => {
            if (alive[i]) {
              result.push({ driverId, distanceKm: Number(dist), lat: Number(la), lng: Number(lon) });
            }
          });
          return result;
        }
      } catch (err: any) {
        this.logger.warn(`Redis geosearch falló, usando motor en memoria: ${err.message}`);
      }
    }

    // Fallback motor en memoria
    const now = Date.now();
    const result: NearbyDriver[] = [];

    for (const [id, pos] of this.memoryPositions.entries()) {
      if (pos.type !== type || pos.busy) continue;
      const hb = this.memoryHeartbeats.get(id);
      if (!hb || hb.expiresAt < now) continue;

      const dist = haversineKm({ lat, lng }, { lat: pos.lat, lng: pos.lng });
      if (dist <= radiusKm) {
        result.push({ driverId: id, distanceKm: Number(dist.toFixed(2)), lat: pos.lat, lng: pos.lng });
      }
    }

    return result.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit);
  }

  async getPosition(driverId: string): Promise<DriverPosition | null> {
    if (this.redis.isReady) {
      try {
        const raw = await this.r.hget(K.positions, driverId);
        if (raw) return JSON.parse(raw) as DriverPosition;
      } catch {}
    }
    return this.memoryPositions.get(driverId) || null;
  }

  /** Posiciones recientes (< 2 min) de todos los conductores conectados */
  async getAllPositions(): Promise<DriverPosition[]> {
    if (this.redis.isReady) {
      try {
        const all = await this.r.hgetall(K.positions);
        const limit = Date.now() - 2 * 60 * 1000;
        return Object.values(all)
          .map((v) => JSON.parse(v) as DriverPosition)
          .filter((p) => p.ts >= limit);
      } catch {}
    }

    const limit = Date.now() - 2 * 60 * 1000;
    return Array.from(this.memoryPositions.values()).filter((p) => p.ts >= limit);
  }

  async getActiveTripId(driverId: string): Promise<string | null> {
    if (this.redis.isReady) {
      try {
        return await this.r.get(K.trip(driverId));
      } catch {}
    }
    return this.memoryBusy.get(driverId) || null;
  }

  /** Marca al conductor como ocupado (sale del GEO set) */
  async setBusy(driverId: string, tripId: string) {
    this.memoryBusy.set(driverId, tripId);
    const pos = this.memoryPositions.get(driverId);
    if (pos) pos.busy = true;

    if (this.redis.isReady) {
      try {
        await this.r.set(K.trip(driverId), tripId);
        await this.removeFromGeo(driverId);
      } catch {}
    }
  }

  /** Libera al conductor; volverá al GEO set con su próxima ubicación */
  async clearBusy(driverId: string) {
    this.memoryBusy.delete(driverId);
    const pos = this.memoryPositions.get(driverId);
    if (pos) pos.busy = false;

    if (this.redis.isReady) {
      try {
        await this.r.del(K.trip(driverId));
      } catch {}
    }
  }

  private async removeFromGeo(driverId: string) {
    if (this.redis.isReady) {
      try {
        await Promise.all(Object.values(VehicleType).map((t) => this.r.zrem(K.geo(t), driverId)));
      } catch {}
    }
  }

  /** Limpieza periódica: quita a quienes perdieron el heartbeat */
  async purgeStale() {
    let removed = 0;
    const now = Date.now();

    // Limpieza en memoria
    for (const [id, hb] of this.memoryHeartbeats.entries()) {
      if (hb.expiresAt < now) {
        this.memoryHeartbeats.delete(id);
        this.memoryPositions.delete(id);
        removed++;
      }
    }

    // Limpieza en Redis solo si está listo
    if (this.redis.isReady) {
      try {
        for (const type of Object.values(VehicleType)) {
          const members = await this.r.zrange(K.geo(type), 0, '-1');
          if (members.length === 0) continue;
          const alive = await this.r.mget(...members.map((id) => K.hb(id)));
          const stale = members.filter((_, i) => !alive[i]);
          if (stale.length) {
            await this.r.zrem(K.geo(type), ...stale);
            await this.r.hdel(K.positions, ...stale);
            removed += stale.length;
          }
        }
      } catch {}
    }

    return removed;
  }
}
