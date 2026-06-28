import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
  Prisma,
  StockMovementType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { buildPaginatedResult } from '../../common/dto/pagination.dto';
import {
  CheckoutDto,
  OrderQueryDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

const ORDER_INCLUDE = {
  items: true,
  payments: true,
  shipments: true,
  coupon: { select: { id: true, code: true } },
  shippingAddress: true,
  billingAddress: true,
  statusHistory: { orderBy: { createdAt: 'desc' as const } },
  user: { select: { id: true, name: true, email: true } },
};

/** Transições de status permitidas. */
const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDENTE: [OrderStatus.PAGO, OrderStatus.CANCELADO],
  PAGO: [OrderStatus.ENVIADO, OrderStatus.CANCELADO, OrderStatus.DEVOLVIDO],
  ENVIADO: [OrderStatus.ENTREGUE, OrderStatus.DEVOLVIDO],
  ENTREGUE: [OrderStatus.DEVOLVIDO],
  CANCELADO: [],
  DEVOLVIDO: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly couponsService: CouponsService,
  ) {}

  private generateOrderNumber() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `PED-${ts}-${rand}`;
  }

  async checkout(userId: string, dto: CheckoutDto) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, stock: true, manageStock: true } },
            variation: { select: { id: true, sku: true, stock: true } },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Carrinho vazio');
    }

    // Valida endereço pertencente ao usuário
    const address = await this.prisma.address.findFirst({
      where: { id: dto.shippingAddressId, userId },
      select: { id: true },
    });
    if (!address) throw new BadRequestException('Endereço de entrega inválido');

    // Valida estoque e calcula subtotal
    let subtotal = 0;
    for (const item of cart.items) {
      const stock = item.variation ? item.variation.stock : item.product.stock;
      if (item.product.manageStock && item.quantity > stock) {
        throw new BadRequestException(
          `Estoque insuficiente para "${item.product.name}"`,
        );
      }
      subtotal += Number(item.unitPrice) * item.quantity;
    }
    subtotal = Math.round(subtotal * 100) / 100;

    // Cupom (opcional)
    let discount = 0;
    let couponId: string | null = null;
    if (dto.couponCode) {
      const result = await this.couponsService.validateAndCalculate(
        dto.couponCode,
        subtotal,
        userId,
      );
      discount = result.discount;
      couponId = result.coupon.id;
    }

    const total = Math.round((subtotal - discount) * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          number: this.generateOrderNumber(),
          userId,
          status: OrderStatus.PENDENTE,
          subtotal,
          discount,
          total,
          couponId,
          shippingAddressId: dto.shippingAddressId,
          billingAddressId: dto.billingAddressId ?? dto.shippingAddressId,
          notes: dto.notes,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              variationId: item.variationId,
              name: item.product.name,
              sku: item.variation?.sku ?? item.product.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: Number(item.unitPrice) * item.quantity,
            })),
          },
          payments: {
            create: {
              method: dto.paymentMethod,
              gateway: PaymentGateway.MANUAL,
              status: PaymentStatus.PENDENTE,
              amount: total,
            },
          },
          statusHistory: {
            create: { status: OrderStatus.PENDENTE, note: 'Pedido criado' },
          },
        },
        include: ORDER_INCLUDE,
      });

      // Baixa de estoque + movimentações
      for (const item of cart.items) {
        if (!item.product.manageStock) continue;
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
          select: { stock: true },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: StockMovementType.SAIDA,
            quantity: item.quantity,
            previous: product.stock + item.quantity,
            current: product.stock,
            reason: 'Venda',
            reference: order.number,
            userId,
          },
        });
      }

      // Registra uso de cupom
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
        await tx.couponUsage.create({
          data: { couponId, userId, orderId: order.id, discount },
        });
      }

      // Esvazia o carrinho
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  async findAllAdmin(query: OrderQueryDto) {
    const { skip, take, page, limit, search, status } = query;
    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async findMine(userId: string, query: OrderQueryDto) {
    const { skip, take, page, limit, status } = query;
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(status ? { status } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string, user: { id: string; role: UserRole }) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    const isStaff = user.role === UserRole.ADMIN || user.role === UserRole.GERENTE;
    if (!isStaff && order.userId !== user.id) {
      throw new ForbiddenException('Acesso negado a este pedido');
    }
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    if (order.status === dto.status) {
      throw new BadRequestException('O pedido já está neste status');
    }
    const allowed = STATUS_FLOW[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transição de ${order.status} para ${dto.status} não permitida`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Repõe estoque em cancelamento/reembolso
      if (
        dto.status === OrderStatus.CANCELADO ||
        dto.status === OrderStatus.DEVOLVIDO
      ) {
        const items = await tx.orderItem.findMany({
          where: { orderId: id, productId: { not: null } },
        });
        for (const item of items) {
          if (!item.productId) continue;
          const product = await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
            select: { stock: true },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: StockMovementType.ENTRADA,
              quantity: item.quantity,
              previous: product.stock - item.quantity,
              current: product.stock,
              reason: `Estorno (${dto.status})`,
            },
          });
        }
      }

      if (dto.status === OrderStatus.PAGO) {
        await tx.payment.updateMany({
          where: { orderId: id, status: PaymentStatus.PENDENTE },
          data: { status: PaymentStatus.APROVADO, paidAt: new Date() },
        });
      }

      await tx.orderStatusHistory.create({
        data: { orderId: id, status: dto.status, note: dto.note },
      });

      return tx.order.update({
        where: { id },
        data: { status: dto.status },
        include: ORDER_INCLUDE,
      });
    });
  }
}
