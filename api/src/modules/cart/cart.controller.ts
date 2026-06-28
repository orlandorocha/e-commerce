import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Carrinho')
@Public()
@UseGuards(OptionalJwtAuthGuard)
@ApiHeader({
  name: 'x-session-id',
  required: false,
  description: 'Identificador de sessão para carrinho de visitante',
})
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Obter carrinho atual' })
  getCart(
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.getCart(userId, sessionId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Adicionar item ao carrinho' })
  addItem(
    @Body() dto: AddCartItemDto,
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.addItem(dto, userId, sessionId);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Atualizar quantidade de um item' })
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.updateItem(itemId, dto, userId, sessionId);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remover item do carrinho' })
  removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.removeItem(itemId, userId, sessionId);
  }

  @Delete()
  @ApiOperation({ summary: 'Esvaziar carrinho' })
  clear(
    @CurrentUser('id') userId: string | undefined,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.clear(userId, sessionId);
  }
}
