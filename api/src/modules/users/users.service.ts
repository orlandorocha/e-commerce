import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildPaginatedResult } from '../../common/dto/pagination.dto';
import { hashPassword } from '../../common/utils/crypto.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto, QueryUserDto, UpdateUserDto } from './dto/user.dto';

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  document: true,
  avatar: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryUserDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('Usuario nao encontrado');
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new BadRequestException('E-mail ja cadastrado');

    return this.prisma.user.create({
      data: {
        ...dto,
        password: await hashPassword(dto.password),
      },
      select: userSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: Prisma.UserUpdateInput = { ...dto };
    if (dto.password) {
      data.password = await hashPassword(dto.password);
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INATIVO' },
    });
    return { message: 'Usuario removido com sucesso' };
  }
}
