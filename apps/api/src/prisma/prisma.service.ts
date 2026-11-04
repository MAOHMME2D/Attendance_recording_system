import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { join } from 'path';

function databaseUrl() {
  // Keep the file next to schema.prisma. A relative file:./ URL is resolved
  // from node_modules/.prisma/client at runtime, which is an empty database.
  const dbPath = join(__dirname, '..', '..', 'prisma', 'attendance.db').replace(/\\/g, '/');
  return `file:${dbPath}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: { url: databaseUrl() },
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
