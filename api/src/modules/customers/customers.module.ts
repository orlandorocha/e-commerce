import { Module } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';

@Module({
  controllers: [AddressesController, WishlistController],
  providers: [AddressesService, WishlistService],
  exports: [AddressesService, WishlistService],
})
export class CustomersModule {}
