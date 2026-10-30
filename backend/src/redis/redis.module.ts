import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private errorLogged = false;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        return Math.min(times * 3000, 15000);
      },
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Conectado a Redis con éxito');
      this.errorLogged = false;
    });

    this.client.on('error', (err) => {
      if (!this.errorLogged) {
        this.logger.warn(
          `⚠️ Redis no está corriendo localmente (${err.message}). El backend usará el motor en memoria para geolocalización.`,
        );
        this.errorLogged = true;
      }
    });
  }

  get isReady(): boolean {
    return this.client.status === 'ready';
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch {
      // Ignorar fallo de conexión inicial; se activará el fallback en memoria
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
