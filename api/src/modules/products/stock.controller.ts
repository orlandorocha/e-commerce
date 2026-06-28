import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto/stock.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Estoque')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.GERENTE)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('low')
  @ApiOperation({ summary: 'Listar produtos com estoque baixo' })
  lowStock(@Query() pagination: PaginationDto) {
    return this.stockService.lowStock(pagination);
  }

  @Post('products/:productId/adjust')
  @ApiOperation({ summary: 'Movimentar estoque (entrada/saída/ajuste)' })
  adjust(
    @Param('productId') productId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.stockService.adjust(productId, dto, userId);
  }

  @Get('products/:productId/history')
  @ApiOperation({ summary: 'Histórico de movimentações do produto' })
  history(
    @Param('productId') productId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.stockService.history(productId, pagination);
  }
}
