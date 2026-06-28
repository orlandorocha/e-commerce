import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma notificacao. O envio efetivo (email/SMS/push) seria feito por um
   * provedor externo; aqui registramos o status para rastreio e auditoria.
   */
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        channel: dto.channel,
        title: dto.title,
        message: dto.message,
        status: NotificationStatus.PENDENTE,
      },
    });
  }

  /** Atalho interno para outros modulos dispararem notificacoes. */
  async notify(params: {
    userId?: string;
    channel?: NotificationChannel;
    title: string;
    message: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        channel: params.channel ?? NotificationChannel.EMAIL,
        title: params.title,
        message: params.message,
        status: NotificationStatus.PENDENTE,
      },
    });
  }

  /** Notificacoes do usuario autenticado. */
  async listForUser(userId: string, query: PaginationQueryDto) {
    const where = { userId };
    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      data,
      meta: {
        total,
        unread,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notificacao nao encontrada');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  /** Marca como enviada (simulando integracao com provedor). */
  async markAsSent(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.ENVIADA, sentAt: new Date() },
    });
  }
}
