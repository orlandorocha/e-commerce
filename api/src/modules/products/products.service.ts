import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  buildPaginatedResult,
} from '../../common/dto/pagination.dto';
import { slugify } from '../../common/utils/slug.util';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateUniqueSlug(name: string, ignoreId?: string) {
    const base = slugify(name);
    let slug = base;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.product.findFirst({
        where: { slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
        select: { id: true },
      });
      if (!existing) break;
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  async create(dto: CreateProductDto) {
    const { categoryIds, images, slug, ...data } = dto;

    const existingSku = await this.prisma.product.findUnique({
      where: { sku: data.sku },
      select: { id: true },
    });
    if (existingSku) {
      throw new BadRequestException('Já existe um produto com este SKU');
    }

    const finalSlug = slug
      ? slugify(slug)
      : await this.generateUniqueSlug(data.name);

    return this.prisma.product.create({
      data: {
        ...data,
        slug: finalSlug,
        ...(categoryIds?.length
          ? {
              categories: {
                create: categoryIds.map((categoryId) => ({ categoryId })),
              },
            }
          : {}),
        ...(images?.length
          ? {
              images: {
                create: images.map((img, index) => ({
                  url: img.url,
                  alt: img.alt,
                  order: img.order ?? index,
                  isCover: img.isCover ?? index === 0,
                })),
              },
            }
          : {}),
      },
      include: {
        categories: { include: { category: true } },
        images: { orderBy: { order: 'asc' } },
        brand: true,
      },
    });
  }

  async findAll(query: ProductQueryDto) {
    const { skip, take, page, limit, search, status, category, brandId, featured, sortBy } =
      query;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(brandId ? { brandId } : {}),
      ...(featured !== undefined ? { featured } : {}),
      ...(category
        ? {
            categories: {
              some: {
                category: { OR: [{ slug: category }, { id: category }] },
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput = (() => {
      switch (sortBy) {
        case 'price':
          return { price: 'asc' };
        case 'price_desc':
          return { price: 'desc' };
        case 'name':
          return { name: 'asc' };
        case 'oldest':
          return { createdAt: 'asc' };
        default:
          return { createdAt: 'desc' };
      }
    })();

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          brand: { select: { id: true, name: true } },
          categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
          images: { orderBy: { order: 'asc' }, take: 1 },
          _count: { select: { reviews: true, variations: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(idOrSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        brand: true,
        supplier: { select: { id: true, name: true } },
        categories: { include: { category: true } },
        images: { orderBy: { order: 'asc' } },
        videos: { orderBy: { order: 'asc' } },
        tags: { include: { tag: true } },
        attributes: { include: { attributeValue: { include: { attribute: true } } } },
        variations: {
          where: { active: true },
          include: {
            attributeValues: {
              include: { attributeValue: { include: { attribute: true } } },
            },
          },
        },
        _count: { select: { reviews: true } },
      },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.ensureExists(id);
    const { categoryIds, images, slug, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (categoryIds) {
        await tx.productCategory.deleteMany({ where: { productId: id } });
        if (categoryIds.length) {
          await tx.productCategory.createMany({
            data: categoryIds.map((categoryId) => ({ productId: id, categoryId })),
          });
        }
      }

      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length) {
          await tx.productImage.createMany({
            data: images.map((img, index) => ({
              productId: id,
              url: img.url,
              alt: img.alt,
              order: img.order ?? index,
              isCover: img.isCover ?? index === 0,
            })),
          });
        }
      }

      return tx.product.update({
        where: { id },
        data: {
          ...data,
          ...(slug ? { slug: slugify(slug) } : {}),
        },
        include: {
          categories: { include: { category: true } },
          images: { orderBy: { order: 'asc' } },
        },
      });
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProductStatus.ARQUIVADO },
    });
    return { message: 'Produto removido com sucesso' };
  }

  private async ensureExists(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }
}
