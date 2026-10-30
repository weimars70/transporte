import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';
import { PrismaClient, Role, VehicleType } from '../src/generated/prisma/client.js';

function getDbUrl(): string {
  const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DATABASE_URL } = process.env;
  if (DB_HOST && DB_USERNAME && DB_PASSWORD && DB_DATABASE) {
    const cleanPass = DB_PASSWORD.replace(/^['"]|['"]$/g, '');
    const encodedPass = encodeURIComponent(cleanPass);
    return `postgresql://${DB_USERNAME}:${encodedPass}@${DB_HOST}:${DB_PORT || 5432}/${DB_DATABASE}?schema=public`;
  }
  return DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/transporte?schema=public';
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getDbUrl() }),
});

async function main() {
  console.log('🌱 Ejecutando seed...');

  const adminPhone = process.env.ADMIN_PHONE ?? '70000000';
  const adminPass = process.env.ADMIN_PASSWORD ?? 'admin123';

  // 1. Admin inicial
  const existingAdmin = await prisma.user.findUnique({
    where: { phone: adminPhone },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPass, 10);
    const admin = await prisma.user.create({
      data: {
        name: 'Administrador Principal',
        phone: adminPhone,
        email: 'admin@transporte.local',
        passwordHash,
        role: Role.ADMIN,
      },
    });
    console.log(`✅ Admin creado con éxito (Teléfono: ${admin.phone}, Clave: ${adminPass})`);
  } else {
    console.log('ℹ️ El usuario administrador ya existe');
  }

  // 2. Tarifas por defecto para CAR y MOTO
  const defaultSettings = [
    {
      vehicleType: VehicleType.CAR,
      baseFare: 1.5,
      perKm: 0.8,
      perMinute: 0.15,
      minimumFare: 2.5,
      bookingFee: 0.5,
      currency: process.env.CURRENCY ?? 'USD',
      biddingEnabled: true,
      minBidPercent: 70,
      commissionPct: 10,
    },
    {
      vehicleType: VehicleType.MOTO,
      baseFare: 1.0,
      perKm: 0.5,
      perMinute: 0.1,
      minimumFare: 1.8,
      bookingFee: 0.3,
      currency: process.env.CURRENCY ?? 'USD',
      biddingEnabled: true,
      minBidPercent: 70,
      commissionPct: 10,
    },
  ];

  for (const s of defaultSettings) {
    await prisma.fareSetting.upsert({
      where: { vehicleType: s.vehicleType },
      create: s,
      update: {
        baseFare: s.baseFare,
        perKm: s.perKm,
        perMinute: s.perMinute,
        minimumFare: s.minimumFare,
        bookingFee: s.bookingFee,
        currency: s.currency,
      },
    });
    console.log(`✅ Tarifa configurada para ${s.vehicleType}`);
  }

  console.log('🎉 Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
