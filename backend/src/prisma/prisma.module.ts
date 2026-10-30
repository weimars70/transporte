import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

function resolveDatabaseUrl(config: ConfigService): string {
  const host = config.get<string>('DB_HOST');
  const user = config.get<string>('DB_USERNAME');
  const pass = config.get<string>('DB_PASSWORD');
  const db = config.get<string>('DB_DATABASE');
  const port = config.get<string>('DB_PORT') ?? '5432';

  if (host && user && pass && db) {
    const cleanPass = pass.replace(/^['"]|['"]$/g, '');
    const encodedPass = encodeURIComponent(cleanPass);
    return `postgresql://${user}:${encodedPass}@${host}:${port}/${db}?schema=public`;
  }

  return config.getOrThrow<string>('DATABASE_URL');
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({ connectionString: resolveDatabaseUrl(config) }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
