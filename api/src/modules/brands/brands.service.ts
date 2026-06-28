import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto, buildPaginatedResult } from '../../common/dto/pagination.dto';
import { slugify } from '../../common/utils/slug.util';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveSlug(name: string, slug?: string, ignoreId?: string) {
    const base = slug ? slugify(slug) : slugify(name);
    let candidate = base;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.brand.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === ignoreId) break;
      candidate = `${base}-${counter++}`;
    }
    return candidate;
  }

  async create(dto: CreateBrandDto) {
    const slug = await this.resolveSlug(dto.name, dto.slug);
    return this.prisma.brand.create({ data: { ...dto, slug } });
  }

  async findAll(pagination: PaginationDto) {
    const { skip, take, page, limit, search } = pagination;
    const where = {
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.brand.count({ where }),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundException('Marca não encontrada');
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.name || dto.slug) {
      data.slug = await this.resolveSlug(dto.name ?? '', dto.slug, id);
    }
    return this.prisma.brand.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.brand.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    return { message: 'Marca removida com sucesso' };
  }
}
