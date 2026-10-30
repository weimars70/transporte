import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Convierte recursivamente los Decimal de Prisma a number para que
 * los clientes (Flutter / Quasar) reciban números y no strings.
 */
export function toPlain<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) return (value as unknown as Prisma.Decimal).toNumber() as T;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => toPlain(v)) as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toPlain(v);
    return out as T;
  }
  return value;
}

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => toPlain(data)));
  }
}
