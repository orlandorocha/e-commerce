import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import { AdjustStockDto } from './dto/stock.dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async adjust(productId: string, dto: AdjustStockDto, userId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true, stock: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    const previous = product.stock;
    let current: number;

    switch (dto.type) {
      case StockMovementType.ENTRADA:
        current = previous + dto.quantity;
        break;
      case StockMovementType.SAIDA:
        current = previous - dto.quantity;
        if (current < 0) {
          throw new BadRequestException('Estoque insuficiente para esta saída');
        }
        break;
      case StockMovementType.AJUSTE:
        current = dto.quantity;
        break;
      default:
        throw new BadRequestException('Tipo de movimentação inválido');
    }

    const delta = current - previous;

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { stock: current },
      });

      return tx.stockMovement.create({
        data: {
          productId,
          type: dto.type,
          quantity: Math.abs(delta) || dto.quantity,
          previous,
          current,
          reason: dto.reason,
          reference: dto.reference,
          userId,
        },
      });
    });
  }

  async history(productId: string, pagination: PaginationDto) {
    const { skip, take, page, limit } = pagination;
    const where = { productId };
    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async lowStock(pagination: PaginationDto) {
    const { skip, take, page, limit } = pagination;
    const products = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, sku, stock, "lowStockAlert" FROM products
       WHERE "deletedAt" IS NULL AND "manageStock" = true AND stock <= "lowStockAlert"
       ORDER BY stock ASC LIMIT $1 OFFSET $2`,
      take,
      skip,
    );
    const countResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint as count FROM products
       WHERE "deletedAt" IS NULL AND "manageStock" = true AND stock <= "lowStockAlert"`,
    );
    const total = Number(countResult[0]?.count ?? 0);
    return buildPaginatedResult(products, total, page, limit);
  }
}
