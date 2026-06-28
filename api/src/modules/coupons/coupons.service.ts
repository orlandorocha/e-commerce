import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import {
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto';

export interface CouponValidationResult {
  coupon: { id: string; code: string; type: CouponType; value: number };
  discount: number;
  subtotalAfterDiscount: number;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase().trim(),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async findAll(pagination: PaginationDto) {
    const { skip, take, page, limit, search } = pagination;
    const where: Prisma.CouponWhereInput = search
      ? { code: { contains: search, mode: 'insensitive' } }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { usages: true } } },
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Cupom não encontrado');
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto) {
    await this.findOne(id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.code ? { code: dto.code.toUpperCase().trim() } : {}),
        ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.coupon.delete({ where: { id } });
    return { message: 'Cupom removido com sucesso' };
  }

  /**
   * Valida um cupom e calcula o desconto sobre o subtotal informado.
   * Usado tanto pela rota pública quanto pelo checkout.
   */
  async validateAndCalculate(
    code: string,
    subtotal: number,
    userId?: string,
  ): Promise<CouponValidationResult> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!coupon || !coupon.active) {
      throw new BadRequestException('Cupom inválido');
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('Cupom ainda não está disponível');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Cupom expirado');
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Cupom esgotado');
    }
    if (coupon.minPurchase && subtotal < Number(coupon.minPurchase)) {
      throw new BadRequestException(
        `Valor mínimo de R$ ${Number(coupon.minPurchase).toFixed(2)} não atingido`,
      );
    }

    if (coupon.perUserLimit && userId) {
      const userUsages = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, userId },
      });
      if (userUsages >= coupon.perUserLimit) {
        throw new BadRequestException(
          'Você já atingiu o limite de uso deste cupom',
        );
      }
    }

    let discount = 0;
    if (coupon.type === CouponType.PERCENTUAL) {
      discount = (subtotal * Number(coupon.value)) / 100;
    } else {
      discount = Number(coupon.value);
    }
    discount = Math.min(discount, subtotal);
    discount = Math.round(discount * 100) / 100;

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
      },
      discount,
      subtotalAfterDiscount: Math.round((subtotal - discount) * 100) / 100,
    };
  }
}
