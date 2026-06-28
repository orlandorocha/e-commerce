import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UpsertSettingDto } from './dto/setting.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(group?: string) {
    return this.prisma.setting.findMany({
      where: group ? { group } : undefined,
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async get(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException('Configuracao nao encontrada');
    return setting;
  }

  upsert(dto: UpsertSettingDto) {
    const value = dto.value as Prisma.InputJsonValue;
    return this.prisma.setting.upsert({
      where: { key: dto.key },
      create: { key: dto.key, value, group: dto.group ?? 'geral' },
      update: { value, group: dto.group ?? 'geral' },
    });
  }

  async remove(key: string) {
    await this.get(key);
    await this.prisma.setting.delete({ where: { key } });
    return { success: true };
  }
}
