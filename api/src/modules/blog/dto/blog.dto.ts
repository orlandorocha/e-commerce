import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '@prisma/client';

export class CreateBlogCategoryDto {
  @ApiProperty({ example: 'Novidades' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'novidades' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreatePostDto {
  @ApiProperty({ example: 'Como escolher o produto ideal' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'como-escolher-o-produto-ideal' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 'Um resumo do artigo.' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiProperty({ example: 'Conteudo completo em markdown ou HTML.' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 'https://.../capa.jpg' })
  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.RASCUNHO })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  metaDescription?: string;
}

export class UpdatePostDto extends CreatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare content: string;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'Otimo artigo!' })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    example: 'Visitante',
    description: 'Nome exibido quando o comentario nao tem usuario logado',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorName?: string;
}

export class ModerateCommentDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  approved: boolean;
}
