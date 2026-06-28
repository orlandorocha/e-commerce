import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto, buildPaginatedResult } from '../../common/dto/pagination.dto';
import { slugify } from '../../common/utils/slug.util';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveSlug(name: string, slug?: string, ignoreId?: string) {
    const base = slug ? slugify(slug) : slugify(name);
    let candidate = base;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: candidate },
      });
      if (!existing || existing.id === ignoreId) break;
      candidate = `${base}-${counter++}`;
    }
    return candidate;
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new BadRequestException('Categoria pai não encontrada');
    }
    const slug = await this.resolveSlug(dto.name, dto.slug);
    return this.prisma.category.create({ data: { ...dto, slug } });
  }

  async findAll(pagination: PaginationDto) {
    const { skip, take, page, limit, search } = pagination;
    const where = {
      deletedAt: null,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { products: true, children: true } },
        },
      }),
      this.prisma.category.count({ where }),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async tree() {
    const all = await this.prisma.category.findMany({
      where: { deletedAt: null, active: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    const map = new Map<string, any>();
    all.forEach((c) => map.set(c.id, { ...c, children: [] }));
    const roots: any[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: { select: { id: true, name: true } },
        children: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
        _count: { select: { products: true } },
      },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    if (dto.parentId === id) {
      throw new ConflictException('Uma categoria não pode ser pai de si mesma');
    }
    const data: any = { ...dto };
    if (dto.name || dto.slug) {
      data.slug = await this.resolveSlug(dto.name ?? '', dto.slug, id);
    }
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    const childCount = await this.prisma.category.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new ConflictException(
        'Remova ou mova as subcategorias antes de excluir esta categoria',
      );
    }
    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    return { message: 'Categoria removida com sucesso' };
  }
}
