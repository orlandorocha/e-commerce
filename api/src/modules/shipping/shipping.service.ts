import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CalculateShippingDto,
  CreateShipmentDto,
  CreateShippingRateDto,
  UpdateShipmentDto,
  UpdateShippingRateDto,
} from './dto/shipping.dto';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------- Tabelas de frete -----------------------

  createRate(dto: CreateShippingRateDto) {
    return this.prisma.shippingRate.create({
      data: {
        carrier: dto.carrier,
        service: dto.service,
        zipFrom: dto.zipFrom,
        zipTo: dto.zipTo,
        cost: new Prisma.Decimal(dto.cost),
        estimatedDays: dto.estimatedDays,
        active: dto.active ?? true,
      },
    });
  }

  listRates() {
    return this.prisma.shippingRate.findMany({
      orderBy: [{ carrier: 'asc' }, { cost: 'asc' }],
    });
  }

  async updateRate(id: string, dto: UpdateShippingRateDto) {
    await this.getRate(id);
    return this.prisma.shippingRate.update({
      where: { id },
      data: {
        ...dto,
        cost: dto.cost !== undefined ? new Prisma.Decimal(dto.cost) : undefined,
      },
    });
  }

  async removeRate(id: string) {
    await this.getRate(id);
    await this.prisma.shippingRate.delete({ where: { id } });
    return { success: true };
  }

  private async getRate(id: string) {
    const rate = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException('Tabela de frete nao encontrada');
    return rate;
  }

  /**
   * Calcula as opcoes de frete disponiveis para um CEP de destino,
   * filtrando as faixas (zipFrom..zipTo) que contem o CEP informado.
   */
  async calculate(dto: CalculateShippingDto) {
    const zip = dto.zipCode;
    const rates = await this.prisma.shippingRate.findMany({
      where: {
        active: true,
        zipFrom: { lte: zip },
        zipTo: { gte: zip },
      },
      orderBy: { cost: 'asc' },
    });

    return {
      zipCode: zip,
      options: rates.map((r) => ({
        id: r.id,
        carrier: r.carrier,
        service: r.service,
        cost: Number(r.cost),
        estimatedDays: r.estimatedDays,
      })),
    };
  }

  // ----------------------- Envios / rastreamento -----------------------

  async createShipment(dto: CreateShipmentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) throw new NotFoundException('Pedido nao encontrado');

    return this.prisma.shipment.create({
      data: {
        orderId: dto.orderId,
        carrier: dto.carrier,
        service: dto.service,
        trackingCode: dto.trackingCode,
        cost: new Prisma.Decimal(dto.cost),
        estimatedDays: dto.estimatedDays,
      },
    });
  }

  listByOrder(orderId: string) {
    return this.prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateShipment(id: string, dto: UpdateShipmentDto) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });
    if (!shipment) throw new NotFoundException('Envio nao encontrado');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id },
        data: {
          trackingCode: dto.trackingCode ?? shipment.trackingCode,
          shippedAt: dto.markShipped ? new Date() : shipment.shippedAt,
          deliveredAt: dto.markDelivered ? new Date() : shipment.deliveredAt,
        },
      });

      // Reflete o status do pedido conforme o envio avanca
      if (dto.markDelivered) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { status: OrderStatus.ENTREGUE },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: shipment.orderId,
            status: OrderStatus.ENTREGUE,
            note: 'Pedido entregue',
          },
        });
      } else if (dto.markShipped) {
        const order = await tx.order.findUnique({
          where: { id: shipment.orderId },
        });
        if (order && order.status === OrderStatus.PAGO) {
          await tx.order.update({
            where: { id: shipment.orderId },
            data: { status: OrderStatus.ENVIADO },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: shipment.orderId,
              status: OrderStatus.ENVIADO,
              note: 'Pedido enviado',
            },
          });
        }
      }

      return updated;
    });
  }
}
