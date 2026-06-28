import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            promoPrice: true,
            status: true,
            images: {
              orderBy: { order: 'asc' },
              take: 1,
              select: { url: true, alt: true },
            },
          },
        },
      },
    });
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');

    const exists = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (exists) throw new ConflictException('Produto já está na lista de desejos');

    return this.prisma.wishlistItem.create({ data: { userId, productId } });
  }

  async remove(userId: string, productId: string) {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!item) throw new NotFoundException('Item não encontrado na lista de desejos');

    await this.prisma.wishlistItem.delete({
      where: { userId_productId: { userId, productId } },
    });
    return { removed: true };
  }
}
