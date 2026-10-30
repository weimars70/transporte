import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import type { AuthUser, JwtPayload } from './types.js';

type AuthRequest = Request & { user?: AuthUser };

// ---------- Decoradores ----------

export const ROLES_KEY = 'roles';
/** Restringe un endpoint a uno o varios roles */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Inyecta el usuario autenticado en el handler */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthRequest>();
  return req.user!;
});

// ---------- Guards ----------

/** Valida el JWT Bearer y que el usuario siga activo */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const header = req.headers.authorization ?? '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Token requerido');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true, driver: { select: { id: true } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Usuario inactivo');

    req.user = { userId: user.id, role: user.role, driverId: user.driver?.id ?? null };
    return true;
  }
}

/** Verifica los roles definidos con @Roles(). Usar después de JwtAuthGuard */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}
