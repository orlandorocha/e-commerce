import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@ApiTags('Enderecos')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar enderecos do usuario' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.addressesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhar endereco' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addressesService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Adicionar endereco' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar endereco' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover endereco' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addressesService.remove(user.id, id);
  }
}
