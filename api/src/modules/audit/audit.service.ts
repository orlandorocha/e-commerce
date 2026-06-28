import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface AuditInput {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  changes?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          changes: input.changes,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (error) {
      // Auditoria nunca deve quebrar a operacao principal.
      this.logger.warn(`Falha ao registrar auditoria: ${String(error)}`);
    }
  }
}
