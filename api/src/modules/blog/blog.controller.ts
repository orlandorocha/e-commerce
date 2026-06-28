import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { BlogService } from './blog.service';
import {
  CreateBlogCategoryDto,
  CreateCommentDto,
  CreatePostDto,
  ModerateCommentDto,
  UpdatePostDto,
} from './dto/blog.dto';

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  // ----------------------- Publico -----------------------

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Listar categorias do blog' })
  listCategories() {
    return this.blogService.listCategories();
  }

  @Public()
  @Get('posts')
  @ApiOperation({ summary: 'Listar posts publicados' })
  listPublished(
    @Query() query: PaginationQueryDto,
    @Query('category') category?: string,
  ) {
    return this.blogService.listPublished(query, category);
  }

  @Public()
  @Get('posts/:slug')
  @ApiOperation({ summary: 'Detalhar post publicado por slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.blogService.getPublishedBySlug(slug);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @Post('posts/:postId/comments')
  @ApiOperation({ summary: 'Comentar em um post (aguarda moderacao)' })
  addComment(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.blogService.addComment(postId, dto, user);
  }

  // ----------------------- Admin -----------------------

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Post('categories')
  @ApiOperation({ summary: 'Criar categoria do blog (admin)' })
  createCategory(@Body() dto: CreateBlogCategoryDto) {
    return this.blogService.createCategory(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Get('admin/posts')
  @ApiOperation({ summary: 'Listar todos os posts (admin)' })
  listAll(@Query() query: PaginationQueryDto) {
    return this.blogService.listAll(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Post('posts')
  @ApiOperation({ summary: 'Criar post (admin)' })
  createPost(@Body() dto: CreatePostDto, @CurrentUser('id') userId: string) {
    return this.blogService.createPost(dto, userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Patch('posts/:id')
  @ApiOperation({ summary: 'Atualizar post (admin)' })
  updatePost(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.blogService.updatePost(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Delete('posts/:id')
  @ApiOperation({ summary: 'Remover post (admin)' })
  removePost(@Param('id') id: string) {
    return this.blogService.removePost(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Get('admin/comments')
  @ApiOperation({ summary: 'Listar comentarios (admin)' })
  listComments(
    @Query() query: PaginationQueryDto,
    @Query('pending') pending?: string,
  ) {
    return this.blogService.listComments(query, pending === 'true');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.GERENTE)
  @Patch('comments/:id/moderate')
  @ApiOperation({ summary: 'Aprovar ou reprovar comentario (admin)' })
  moderateComment(@Param('id') id: string, @Body() dto: ModerateCommentDto) {
    return this.blogService.moderateComment(id, dto);
  }
}
