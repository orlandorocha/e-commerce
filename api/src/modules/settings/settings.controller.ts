import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SettingsService } from './settings.service';
import { UpsertSettingDto } from './dto/setting.dto';

@ApiTags('Configuracoes')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Algumas configuracoes (ex.: nome da loja) precisam ser publicas para a vitrine
  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Listar configuracoes de um grupo publico' })
  listPublic(@Query('group') group?: string) {
    return this.settingsService.list(group);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Get()
  @ApiOperation({ summary: 'Listar configuracoes (admin)' })
  list(@Query('group') group?: string) {
    return this.settingsService.list(group);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Get(':key')
  @ApiOperation({ summary: 'Obter uma configuracao por chave (admin)' })
  get(@Param('key') key: string) {
    return this.settingsService.get(key);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Put()
  @ApiOperation({ summary: 'Criar ou atualizar configuracao (admin)' })
  upsert(@Body() dto: UpsertSettingDto) {
    return this.settingsService.upsert(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete(':key')
  @ApiOperation({ summary: 'Remover configuracao (admin)' })
  remove(@Param('key') key: string) {
    return this.settingsService.remove(key);
  }
}
