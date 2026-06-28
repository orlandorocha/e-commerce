import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.GERENTE)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Indicadores gerais da loja' })
  overview() {
    return this.dashboardService.overview();
  }

  @Get('sales')
  @ApiOperation({ summary: 'Vendas por dia' })
  sales(@Query('days') days?: string) {
    return this.dashboardService.salesByDay(days ? Number(days) : 30);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Produtos mais vendidos' })
  topProducts(@Query('limit') limit?: string) {
    return this.dashboardService.topProducts(limit ? Number(limit) : 5);
  }

  @Get('recent-orders')
  @ApiOperation({ summary: 'Pedidos recentes' })
  recentOrders(@Query('limit') limit?: string) {
    return this.dashboardService.recentOrders(limit ? Number(limit) : 8);
  }
}
