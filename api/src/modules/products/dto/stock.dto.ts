import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class AdjustStockDto {
  @ApiProperty({ enum: StockMovementType, example: StockMovementType.ENTRADA })
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @ApiProperty({ example: 10, description: 'Quantidade (ou valor absoluto no AJUSTE)' })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ example: 'Reposição de fornecedor' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 'NF-12345' })
  @IsOptional()
  @IsString()
  reference?: string;
}
