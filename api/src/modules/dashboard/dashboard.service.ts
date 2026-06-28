import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      pendingOrders,
      totalCustomers,
      totalProducts,
      revenueAgg,
      monthRevenueAgg,
      lowStockCount,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PENDENTE } }),
      this.prisma.user.count({ where: { role: 'CLIENTE', deletedAt: null } }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.APROVADO },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.APROVADO, paidAt: { gte: startOfMonth } },
      }),
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint as count FROM products
         WHERE "deletedAt" IS NULL AND "manageStock" = true AND stock <= "lowStockAlert"`,
      ),
    ]);

    return {
      totalOrders,
      pendingOrders,
      totalCustomers,
      totalProducts,
      totalRevenue: Number(revenueAgg._sum.amount ?? 0),
      monthRevenue: Number(monthRevenueAgg._sum.amount ?? 0),
      lowStockProducts: Number(lowStockCount[0]?.count ?? 0),
    };
  }

  async salesByDay(days = 30) {
    const rows = await this.prisma.$queryRawUnsafe<
      { day: Date; total: number; orders: bigint }[]
    >(
      `SELECT date_trunc('day', p."paidAt") as day,
              SUM(p.amount)::float as total,
              COUNT(DISTINCT p."orderId")::bigint as orders
       FROM payments p
       WHERE p.status = 'APROVADO' AND p."paidAt" >= NOW() - ($1 || ' days')::interval
       GROUP BY day ORDER BY day ASC`,
      days,
    );
    return rows.map((r) => ({
      day: r.day,
      total: Number(r.total ?? 0),
      orders: Number(r.orders ?? 0),
    }));
  }

  async topProducts(limit = 5) {
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
      where: { productId: { not: null } },
    });
    return rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      quantitySold: r._sum.quantity ?? 0,
      revenue: Number(r._sum.total ?? 0),
    }));
  }

  async recentOrders(limit = 8) {
    return this.prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
}
