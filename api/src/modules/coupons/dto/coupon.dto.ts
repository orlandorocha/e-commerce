import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CouponType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({ example: 'BEMVINDO10' })
  @IsString()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CouponType, example: CouponType.PERCENTUAL })
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({ example: 10, description: 'Percentual (0-100) ou valor fixo' })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ example: 50, description: 'Valor mínimo de compra' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPurchase?: number;

  @ApiPropertyOptional({ description: 'Total máximo de usos' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({ description: 'Limite de usos por usuário' })
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class ValidateCouponDto {
  @ApiProperty({ example: 'BEMVINDO10' })
  @IsString()
  code: string;

  @ApiProperty({ example: 150.0, description: 'Subtotal do carrinho' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subtotal: number;
}
