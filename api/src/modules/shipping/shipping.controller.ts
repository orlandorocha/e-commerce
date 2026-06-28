import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ShippingService } from './shipping.service';
import {
  CalculateShippingDto,
  CreateShipmentDto,
  CreateShippingRateDto,
  UpdateShipmentDto,
  UpdateShippingRateDto,
} from './dto/shipping.dto';

@ApiTags('Fretes')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // Publico: clientes calculam frete na vitrine/checkout
  @Public()
  @Post('calculate')
  @ApiOperation({ summary: 'Calcular opcoes de frete para um CEP' })
  calculate(@Body() dto: CalculateShippingDto) {
    return this.shippingService.calculate(dto);
  }

  @Public()
  @Get('rates')
  @ApiOperation({ summary: 'Listar tabelas de frete' })
  listRates() {
    return this.shippingService.listRates();
  }

  // Admin: gestao das tabelas de frete
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Post('rates')
  @ApiOperation({ summary: 'Criar tabela de frete (admin)' })
  createRate(@Body() dto: CreateShippingRateDto) {
    return this.shippingService.createRate(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Patch('rates/:id')
  @ApiOperation({ summary: 'Atualizar tabela de frete (admin)' })
  updateRate(@Param('id') id: string, @Body() dto: UpdateShippingRateDto) {
    return this.shippingService.updateRate(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Delete('rates/:id')
  @ApiOperation({ summary: 'Remover tabela de frete (admin)' })
  removeRate(@Param('id') id: string) {
    return this.shippingService.removeRate(id);
  }

  // Admin: envios / rastreamento
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Post('shipments')
  @ApiOperation({ summary: 'Registrar envio de um pedido (admin)' })
  createShipment(@Body() dto: CreateShipmentDto) {
    return this.shippingService.createShipment(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Get('shipments/order/:orderId')
  @ApiOperation({ summary: 'Listar envios de um pedido (admin)' })
  listByOrder(@Param('orderId') orderId: string) {
    return this.shippingService.listByOrder(orderId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Patch('shipments/:id')
  @ApiOperation({ summary: 'Atualizar envio / rastreamento (admin)' })
  updateShipment(@Param('id') id: string, @Body() dto: UpdateShipmentDto) {
    return this.shippingService.updateShipment(id, dto);
  }
}
