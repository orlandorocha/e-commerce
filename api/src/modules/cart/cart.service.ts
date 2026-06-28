import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          stock: true,
          manageStock: true,
          images: { orderBy: { order: 'asc' as const }, take: 1 },
        },
      },
      variation: { select: { id: true, sku: true, stock: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /** Localiza ou cria o carrinho do usuário (ou visitante via sessionId). */
  private async resolveCart(userId?: string, sessionId?: string) {
    if (!userId && !sessionId) {
      throw new BadRequestException('Identificação de carrinho ausente');
    }
    let cart = await this.prisma.cart.findFirst({
      where: userId ? { userId } : { sessionId },
      include: CART_INCLUDE,
    });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId: userId ?? null, sessionId: userId ? null : sessionId },
        include: CART_INCLUDE,
      });
    }
    return cart;
  }

  private summarize(cart: any) {
    const items = cart.items.map((item: any) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.unitPrice) * item.quantity,
    }));
    const subtotal = items.reduce(
      (acc: number, item: any) => acc + item.lineTotal,
      0,
    );
    const totalItems = items.reduce(
      (acc: number, item: any) => acc + item.quantity,
      0,
    );
    return {
      id: cart.id,
      items,
      totalItems,
      subtotal: Math.round(subtotal * 100) / 100,
    };
  }

  async getCart(userId?: string, sessionId?: string) {
    const cart = await this.resolveCart(userId, sessionId);
    return this.summarize(cart);
  }

  async addItem(dto: AddCartItemDto, userId?: string, sessionId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      select: { id: true, price: true, promoPrice: true, stock: true, manageStock: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    let unitPrice = Number(product.promoPrice ?? product.price);
    let availableStock = product.stock;

    if (dto.variationId) {
      const variation = await this.prisma.productVariation.findFirst({
        where: { id: dto.variationId, productId: dto.productId, active: true },
        select: { price: true, promoPrice: true, stock: true },
      });
      if (!variation) throw new NotFoundException('Variação não encontrada');
      unitPrice = Number(variation.promoPrice ?? variation.price ?? unitPrice);
      availableStock = variation.stock;
    }

    const cart = await this.resolveCart(userId, sessionId);
    const existing = cart.items.find(
      (i: any) => i.productId === dto.productId && i.variationId === (dto.variationId ?? null),
    );
    const desiredQty = (existing?.quantity ?? 0) + dto.quantity;

    if (product.manageStock && desiredQty > availableStock) {
      throw new BadRequestException('Quantidade indisponível em estoque');
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: desiredQty, unitPrice },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          variationId: dto.variationId ?? null,
          quantity: dto.quantity,
          unitPrice,
        },
      });
    }

    return this.getCart(userId, sessionId);
  }

  async updateItem(
    itemId: string,
    dto: UpdateCartItemDto,
    userId?: string,
    sessionId?: string,
  ) {
    const cart = await this.resolveCart(userId, sessionId);
    const item = cart.items.find((i: any) => i.id === itemId);
    if (!item) throw new NotFoundException('Item não encontrado no carrinho');

    if (item.product.manageStock && dto.quantity > item.product.stock) {
      throw new BadRequestException('Quantidade indisponível em estoque');
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });
    return this.getCart(userId, sessionId);
  }

  async removeItem(itemId: string, userId?: string, sessionId?: string) {
    const cart = await this.resolveCart(userId, sessionId);
    const item = cart.items.find((i: any) => i.id === itemId);
    if (!item) throw new NotFoundException('Item não encontrado no carrinho');
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId, sessionId);
  }

  async clear(userId?: string, sessionId?: string) {
    const cart = await this.resolveCart(userId, sessionId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId, sessionId);
  }
}
