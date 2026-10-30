import type { Role } from '../generated/prisma/client.js';

/** Contenido del JWT */
export interface JwtPayload {
  sub: string;
  role: Role;
  driverId: string | null;
}

/** Usuario autenticado disponible en request.user y socket.data.user */
export interface AuthUser {
  userId: string;
  role: Role;
  driverId: string | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}
