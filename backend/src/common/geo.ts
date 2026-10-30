import type { LatLng } from './types.js';

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia en línea recta entre dos puntos (km) */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** ETA aproximado en segundos a partir de una distancia y velocidad urbana promedio */
export function estimateEtaSeconds(distanceKm: number, avgSpeedKmh = 25): number {
  return Math.round((distanceKm / avgSpeedKmh) * 3600);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
