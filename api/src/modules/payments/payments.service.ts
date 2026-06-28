import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
  Prisma,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentDto, UpdatePaymentStatusDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreatePaymentDto, actorId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) throw new NotFoundException('Pedido nao encontrado');

    const amount = dto.amount ?? Number(order.total);

    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        method: dto.method,
        gateway: dto.gateway ?? PaymentGateway.MANUAL,
        amount: new Prisma.Decimal(amount),
        installments: dto.installments ?? 1,
        transactionId: dto.transactionId,
        status: PaymentStatus.PENDENTE,
      },
    });

    await this.audit.record({
      action: 'CREATE',
      entity: 'Payment',
      entityId: payment.id,
      userId: actorId,
    });

    return payment;
  }

  async findByOrder(orderId: string) {
    return this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Pagamento nao encontrado');
    return payment;
  }

  /**
   * Atualiza o status do pagamento e reflete no pedido:
   * - APROVADO -> pedido vira PAGO (se ainda PENDENTE)
   * - ESTORNADO -> pedido vira DEVOLVIDO e estoque retorna
   */
  async updateStatus(id: string, dto: UpdatePaymentStatusDto, actorId?: string) {
    const payment = await this.findOne(id);

    if (payment.status === dto.status) {
      throw new BadRequestException('Pagamento ja esta neste status');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: dto.status,
          transactionId: dto.transactionId ?? payment.transactionId,
          paidAt:
            dto.status === PaymentStatus.APROVADO ? new Date() : payment.paidAt,
        },
      });

      if (dto.status === PaymentStatus.APROVADO) {
        const order = await tx.order.findUnique({
          where: { id: payment.orderId },
        });
        if (order && order.status === OrderStatus.PENDENTE) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.PAGO },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: OrderStatus.PAGO,
              note: 'Pagamento aprovado',
            },
          });
        }
      }

      if (dto.status === PaymentStatus.ESTORNADO) {
        const order = await tx.order.findUnique({
          where: { id: payment.orderId },
          include: { items: true },
        });
        if (order && order.status !== OrderStatus.DEVOLVIDO) {
          for (const item of order.items) {
            if (item.productId) {
              const product = await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  type: StockMovementType.ENTRADA,
                  quantity: item.quantity,
                  previous: product.stock - item.quantity,
                  current: product.stock,
                  reason: `Estorno do pedido ${order.number}`,
                  reference: order.number,
                  userId: actorId,
                },
              });
            }
          }
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.DEVOLVIDO },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: OrderStatus.DEVOLVIDO,
              note: 'Pagamento estornado',
            },
          });
        }
      }

      await this.audit.record({
        action: 'UPDATE',
        entity: 'Payment',
        entityId: id,
        userId: actorId,
        changes: { status: dto.status },
      });

      return updated;
    });
  }
}
