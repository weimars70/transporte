import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import type { JwtPayload } from '../common/types.js';
import { LoginDto, RegisterDriverDto, RegisterPassengerDto } from './auth.dto.js';

/** Campos públicos del usuario (nunca exponer passwordHash) */
export const publicUserSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  avatarUrl: true,
  rating: true,
  ratingCount: true,
  createdAt: true,
  driver: {
    select: {
      id: true,
      status: true,
      isOnline: true,
      licenseNumber: true,
      totalTrips: true,
      vehicle: true,
    },
  },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async registerPassenger(dto: RegisterPassengerDto) {
    await this.ensureUnique(dto.phone, dto.email);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: Role.PASSENGER,
      },
      select: publicUserSelect,
    });
    return this.buildSession(user);
  }

  async registerDriver(dto: RegisterDriverDto) {
    await this.ensureUnique(dto.phone, dto.email);
    const plate = dto.vehicle.plate.toUpperCase().replace(/\s+/g, '');
    if (await this.prisma.vehicle.findUnique({ where: { plate } })) {
      throw new ConflictException('La placa ya está registrada');
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: Role.DRIVER,
        driver: {
          create: {
            licenseNumber: dto.licenseNumber,
            vehicle: { create: { ...dto.vehicle, plate } },
          },
        },
      },
      select: publicUserSelect,
    });
    return this.buildSession(user);
  }

  async login(dto: LoginDto) {
    const found = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!found || !(await bcrypt.compare(dto.password, found.passwordHash))) {
      throw new UnauthorizedException('Teléfono o contraseña incorrectos');
    }
    if (!found.isActive) throw new UnauthorizedException('Cuenta desactivada');

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: found.id },
      select: publicUserSelect,
    });
    return this.buildSession(user);
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect });
  }

  private async ensureUnique(phone: string, email?: string) {
    if (await this.prisma.user.findUnique({ where: { phone } })) {
      throw new ConflictException('El teléfono ya está registrado');
    }
    if (email && (await this.prisma.user.findUnique({ where: { email } }))) {
      throw new ConflictException('El email ya está registrado');
    }
  }

  private async buildSession(user: { id: string; role: Role; driver: { id: string } | null }) {
    const payload: JwtPayload = { sub: user.id, role: user.role, driverId: user.driver?.id ?? null };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }
}
