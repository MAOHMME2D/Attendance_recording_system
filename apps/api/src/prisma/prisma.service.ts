import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { loadEnvironment } from '../common/utils/load-env';
import { resolveDatabaseUrl } from './database-url';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    loadEnvironment();
    const url = resolveDatabaseUrl();
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. PostgreSQL is the runtime database: copy ' +
          'apps/api/.env.example to apps/api/.env and set DATABASE_URL (see docs/POSTGRES_MIGRATION.md).',
      );
    }
    super({
      datasources: {
        db: { url },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
