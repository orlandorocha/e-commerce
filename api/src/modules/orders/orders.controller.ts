import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  CheckoutDto,
  OrderQueryDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Pedidos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Finalizar compra a partir do carrinho' })
  checkout(@CurrentUser('id') userId: string, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Meus pedidos' })
  findMine(@CurrentUser('id') userId: string, @Query() query: OrderQueryDto) {
    return this.ordersService.findMine(userId, query);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @ApiOperation({ summary: 'Listar todos os pedidos (admin)' })
  findAllAdmin(@Query() query: OrderQueryDto) {
    return this.ordersService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhar pedido' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.ordersService.findOne(id, user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @ApiOperation({ summary: 'Atualizar status do pedido (admin)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }
}
