import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DriversModule } from './drivers/drivers.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { RedisModule } from './redis/redis.module.js';
import { TripsModule } from './trips/trips.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    PricingModule,
    AuthModule,
    DriversModule,
    RealtimeModule,
    TripsModule,
    AdminModule,
  ],
})
export class AppModule {}
