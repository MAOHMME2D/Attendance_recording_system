import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
}

/**
 * Append-only audit trail. Logging must never break the main operation,
 * but failures are surfaced in the API logs.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: entry.actorUserId || null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId || null,
          details: entry.details ? entry.details.slice(0, 2000) : null,
          ipAddress: entry.ipAddress || null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log (${entry.action})`, error as Error);
    }
  }
}
