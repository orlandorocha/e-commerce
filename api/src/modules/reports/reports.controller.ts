import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Relatorios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.GERENTE)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Relatorio de vendas (faturamento e serie diaria)' })
  @ApiQuery({ name: 'from', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2025-12-31' })
  sales(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.sales(from, to);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Produtos mais vendidos' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  topProducts(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.topProducts(from, to, limit ? +limit : 10);
  }

  @Get('top-customers')
  @ApiOperation({ summary: 'Melhores clientes por valor gasto' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  topCustomers(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.topCustomers(from, to, limit ? +limit : 10);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Relatorio de estoque (baixo estoque)' })
  @ApiQuery({ name: 'threshold', required: false, example: 5 })
  inventory(@Query('threshold') threshold?: string) {
    return this.reportsService.inventory(threshold ? +threshold : 5);
  }
}
