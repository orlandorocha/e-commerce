import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShippingCarrier } from '@prisma/client';

export class CreateShippingRateDto {
  @ApiProperty({ enum: ShippingCarrier })
  @IsEnum(ShippingCarrier)
  carrier: ShippingCarrier;

  @ApiProperty({ example: 'PAC' })
  @IsString()
  service: string;

  @ApiProperty({ example: '01000000', description: 'CEP inicial (somente numeros)' })
  @IsString()
  @Length(8, 8)
  zipFrom: string;

  @ApiProperty({ example: '09999999', description: 'CEP final (somente numeros)' })
  @IsString()
  @Length(8, 8)
  zipTo: string;

  @ApiProperty({ example: 24.9 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  cost: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(0)
  estimatedDays: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateShippingRateDto {
  @ApiPropertyOptional({ enum: ShippingCarrier })
  @IsOptional()
  @IsEnum(ShippingCarrier)
  carrier?: ShippingCarrier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 8)
  zipFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 8)
  zipTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CalculateShippingDto {
  @ApiProperty({ example: '04567000', description: 'CEP de destino (somente numeros)' })
  @IsString()
  @Length(8, 8)
  zipCode: string;
}

export class CreateShipmentDto {
  @ApiProperty({ example: 'uuid-do-pedido' })
  @IsString()
  orderId: string;

  @ApiProperty({ enum: ShippingCarrier })
  @IsEnum(ShippingCarrier)
  carrier: ShippingCarrier;

  @ApiPropertyOptional({ example: 'SEDEX' })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional({ example: 'BR123456789BR' })
  @IsOptional()
  @IsString()
  trackingCode?: string;

  @ApiProperty({ example: 24.9 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDays?: number;
}

export class UpdateShipmentDto {
  @ApiPropertyOptional({ example: 'BR123456789BR' })
  @IsOptional()
  @IsString()
  trackingCode?: string;

  @ApiPropertyOptional({ description: 'Marcar como enviado agora' })
  @IsOptional()
  @IsBoolean()
  markShipped?: boolean;

  @ApiPropertyOptional({ description: 'Marcar como entregue agora' })
  @IsOptional()
  @IsBoolean()
  markDelivered?: boolean;
}
