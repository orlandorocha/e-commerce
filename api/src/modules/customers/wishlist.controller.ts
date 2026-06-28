import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';

@ApiTags('Lista de Desejos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os itens da lista de desejos do usuario' })
  list(@CurrentUser('id') userId: string) {
    return this.wishlistService.list(userId);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Adiciona um produto a lista de desejos' })
  add(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.wishlistService.add(userId, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove um produto da lista de desejos' })
  remove(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.wishlistService.remove(userId, productId);
  }
}
