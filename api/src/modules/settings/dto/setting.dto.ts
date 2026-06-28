import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertSettingDto {
  @ApiProperty({ example: 'store.name' })
  @IsString()
  key: string;

  @ApiProperty({
    description: 'Valor em JSON (string, numero, objeto ou array).',
    example: { nome: 'Minha Loja', moeda: 'BRL' },
  })
  value: unknown;

  @ApiPropertyOptional({ example: 'loja', default: 'geral' })
  @IsOptional()
  @IsString()
  group?: string;
}
