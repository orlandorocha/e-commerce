import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAGO,
  OrderStatus.ENVIADO,
  OrderStatus.ENTREGUE,
];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string) {
    const gte = from ? new Date(from) : undefined;
    const lte = to ? new Date(to) : undefined;
    return gte || lte ? { gte, lte } : undefined;
  }

  /** Relatorio de vendas: faturamento, ticket medio e serie diaria. */
  async sales(from?: string, to?: string) {
    const createdAt = this.range(from, to);
    const where: Prisma.OrderWhereInput = {
      status: { in: REVENUE_STATUSES },
      ...(createdAt ? { createdAt } : {}),
    };

    const [aggregate, orders] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: { total: true, discount: true, shippingCost: true },
        _count: true,
        _avg: { total: true },
      }),
      this.prisma.order.findMany({
        where,
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Agrupa por dia (YYYY-MM-DD)
    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const current = byDay.get(day) ?? { revenue: 0, orders: 0 };
      current.revenue += Number(o.total);
      current.orders += 1;
      byDay.set(day, current);
    }

    return {
      totalRevenue: Number(aggregate._sum.total ?? 0),
      totalDiscount: Number(aggregate._sum.discount ?? 0),
      totalShipping: Number(aggregate._sum.shippingCost ?? 0),
      totalOrders: aggregate._count,
      averageTicket: Number(aggregate._avg.total ?? 0),
      series: Array.from(byDay.entries()).map(([date, v]) => ({
        date,
        revenue: Number(v.revenue.toFixed(2)),
        orders: v.orders,
      })),
    };
  }

  /** Produtos mais vendidos no periodo. */
  async topProducts(from?: string, to?: string, limit = 10) {
    const createdAt = this.range(from, to);
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      where: {
        productId: { not: null },
        order: {
          status: { in: REVENUE_STATUSES },
          ...(createdAt ? { createdAt } : {}),
        },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    return grouped.map((g) => ({
      productId: g.productId,
      name: g.name,
      quantitySold: g._sum.quantity ?? 0,
      revenue: Number(g._sum.total ?? 0),
    }));
  }

  /** Melhores clientes por valor gasto. */
  async topCustomers(from?: string, to?: string, limit = 10) {
    const createdAt = this.range(from, to);
    const grouped = await this.prisma.order.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        status: { in: REVENUE_STATUSES },
        ...(createdAt ? { createdAt } : {}),
      },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const userIds = grouped
      .map((g) => g.userId)
      .filter((id): id is string => Boolean(id));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return grouped.map((g) => ({
      userId: g.userId,
      name: g.userId ? userMap.get(g.userId)?.name ?? null : null,
      email: g.userId ? userMap.get(g.userId)?.email ?? null : null,
      totalSpent: Number(g._sum.total ?? 0),
      orders: g._count,
    }));
  }

  /** Estoque: produtos com baixo estoque e valor total imobilizado. */
  async inventory(threshold = 5) {
    const [lowStock, aggregate] = await Promise.all([
      this.prisma.product.findMany({
        where: { deletedAt: null, stock: { lte: threshold } },
        select: { id: true, name: true, sku: true, stock: true, price: true },
        orderBy: { stock: 'asc' },
      }),
      this.prisma.product.aggregate({
        where: { deletedAt: null },
        _sum: { stock: true },
        _count: true,
      }),
    ]);

    return {
      threshold,
      lowStockCount: lowStock.length,
      totalProducts: aggregate._count,
      totalUnits: aggregate._sum.stock ?? 0,
      lowStock: lowStock.map((p) => ({
        ...p,
        price: Number(p.price),
      })),
    };
  }
}
