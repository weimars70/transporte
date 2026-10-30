import { Global, Injectable, Logger, Module, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { estimateEtaSeconds, haversineKm, round2 } from '../common/geo.js';
import type { LatLng } from '../common/types.js';
import { FareSetting, VehicleType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';

export interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string | null;
  source: 'google' | 'estimate';
}

/** Cálculo de rutas y geocodificación de direcciones (Google / OpenStreetMap Nominatim / Fallback inteligente) */
@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);

  constructor(private readonly config: ConfigService) {}

  /** Convierte una dirección de texto en coordenadas (lat, lng) automáticamente */
  async geocode(address: string, fallbackBase: LatLng = { lat: -17.7833, lng: -63.1821 }): Promise<LatLng> {
    const clean = address.trim();
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');

    // 1. Intentar con Google Geocoding API si hay API Key
    if (key) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(clean)}&key=${key}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = (await res.json()) as {
            results?: { geometry?: { location?: { lat: number; lng: number } } }[];
          };
          const loc = data.results?.[0]?.geometry?.location;
          if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
            return { lat: loc.lat, lng: loc.lng };
          }
        }
      } catch (e) {
        this.logger.warn(`Google Geocoding falló para "${clean}": ${(e as Error).message}`);
      }
    }

    // 2. Intentar con OpenStreetMap Nominatim (gratuito, sin API key)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(clean)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'UrbanRide-Transport-Platform/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as { lat?: string; lon?: string }[];
        if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            return { lat, lng };
          }
        }
      }
    } catch (e) {
      this.logger.warn(`Nominatim Geocoding falló para "${clean}": ${(e as Error).message}`);
    }

    // 3. Fallback determinístico basado en el texto de la dirección (si no hay internet o la calle es local)
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) | 0;
    }
    const latOffset = ((hash % 400) / 10000); // ±0.04 grados (~4 km)
    const lngOffset = (((hash >> 8) % 400) / 10000);
    return {
      lat: Number((fallbackBase.lat + latOffset).toFixed(6)),
      lng: Number((fallbackBase.lng + lngOffset).toFixed(6)),
    };
  }

  async route(origin: LatLng, destination: LatLng): Promise<RouteInfo> {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (key) {
      try {
        return await this.googleRoute(origin, destination, key);
      } catch (e) {
        this.logger.warn(`Google Routes falló, usando estimación: ${(e as Error).message}`);
      }
    }
    // Fallback: línea recta * factor de desvío urbano
    const km = haversineKm(origin, destination) * 1.35;
    return {
      distanceMeters: Math.round(km * 1000),
      durationSeconds: estimateEtaSeconds(km),
      polyline: null,
      source: 'estimate',
    };
  }

  private async googleRoute(o: LatLng, d: LatLng, key: string): Promise<RouteInfo> {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: o.lat, longitude: o.lng } } },
        destination: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as {
      routes?: { distanceMeters: number; duration: string; polyline?: { encodedPolyline: string } }[];
    };
    const r = data.routes?.[0];
    if (!r) throw new Error('Sin rutas');
    return {
      distanceMeters: r.distanceMeters,
      durationSeconds: parseInt(r.duration, 10),
      polyline: r.polyline?.encodedPolyline ?? null,
      source: 'google',
    };
  }
}

/** Cálculo de tarifas según la configuración del panel admin */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSetting(type: VehicleType): Promise<FareSetting> {
    const setting = await this.prisma.fareSetting.findUnique({ where: { vehicleType: type } });
    if (!setting) throw new NotFoundException(`No hay tarifa configurada para ${type}`);
    return setting;
  }

  /** tarifa = max(mínima, base + km*perKm + min*perMinute) + cargo de reserva */
  calculate(s: FareSetting, distanceMeters: number, durationSeconds: number): number {
    const km = distanceMeters / 1000;
    const minutes = durationSeconds / 60;
    const raw = s.baseFare.toNumber() + km * s.perKm.toNumber() + minutes * s.perMinute.toNumber();
    return round2(Math.max(s.minimumFare.toNumber(), raw) + s.bookingFee.toNumber());
  }

  /** Oferta mínima permitida al pasajero en modo BIDDING */
  minBid(s: FareSetting, estimatedFare: number): number {
    return round2((estimatedFare * s.minBidPercent) / 100);
  }
}

@Global()
@Module({
  providers: [MapsService, PricingService],
  exports: [MapsService, PricingService],
})
export class PricingModule {}
