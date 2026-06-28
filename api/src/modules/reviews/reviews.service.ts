import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateReviewDto, ModerateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Produto nao encontrado');

    // Permite uma avaliacao por produto por usuario
    const existing = await this.prisma.review.findFirst({
      where: { productId: dto.productId, userId },
    });
    if (existing) {
      throw new BadRequestException('Voce ja avaliou este produto');
    }

    // Compra verificada: o usuario possui um pedido entregue com o produto
    const purchased = await this.prisma.orderItem.findFirst({
      where: {
        productId: dto.productId,
        order: { userId, status: OrderStatus.ENTREGUE },
      },
    });

    return this.prisma.review.create({
      data: {
        productId: dto.productId,
        userId,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        // compra verificada entra como aprovada; demais aguardam moderacao
        status: purchased ? ReviewStatus.APROVADO : ReviewStatus.PENDENTE,
        photos: dto.photos?.length
          ? { create: dto.photos.map((url) => ({ url })) }
          : undefined,
      },
      include: { photos: true },
    });
  }

  /** Avaliacoes aprovadas e publicas de um produto. */
  async listByProduct(productId: string, query: PaginationQueryDto) {
    const where = { productId, status: ReviewStatus.APROVADO };
    const [data, total, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          photos: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        averageRating: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count,
      },
    };
  }

  /** Lista para o painel admin (todos os status). */
  async listAll(query: PaginationQueryDto, status?: ReviewStatus) {
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          photos: true,
          product: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async moderate(id: string, dto: ModerateReviewDto) {
    await this.getOne(id);
    return this.prisma.review.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async remove(id: string, userId: string, isStaff: boolean) {
    const review = await this.getOne(id);
    if (!isStaff && review.userId !== userId) {
      throw new ForbiddenException('Voce nao pode remover esta avaliacao');
    }
    await this.prisma.review.delete({ where: { id } });
    return { success: true };
  }

  private async getOne(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Avaliacao nao encontrada');
    return review;
  }
}
