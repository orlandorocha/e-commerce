import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { slugify } from '../../common/utils/slug.util';
import {
  CreateBlogCategoryDto,
  CreateCommentDto,
  CreatePostDto,
  ModerateCommentDto,
  UpdatePostDto,
} from './dto/blog.dto';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------- Categorias -----------------------

  async createCategory(dto: CreateBlogCategoryDto) {
    return this.prisma.blogCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug ? slugify(dto.slug) : slugify(dto.name),
        description: dto.description,
      },
    });
  }

  listCategories() {
    return this.prisma.blogCategory.findMany({ orderBy: { name: 'asc' } });
  }

  // ----------------------- Posts -----------------------

  async createPost(dto: CreatePostDto, authorId?: string) {
    return this.prisma.post.create({
      data: {
        title: dto.title,
        slug: dto.slug ? slugify(dto.slug) : slugify(dto.title),
        excerpt: dto.excerpt,
        content: dto.content,
        coverImage: dto.coverImage,
        status: dto.status ?? PostStatus.RASCUNHO,
        publishedAt: dto.status === PostStatus.PUBLICADO ? new Date() : null,
        categoryId: dto.categoryId,
        authorId,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
    });
  }

  async updatePost(id: string, dto: UpdatePostDto) {
    const post = await this.getPostById(id);

    const willPublish =
      dto.status === PostStatus.PUBLICADO && post.status !== PostStatus.PUBLICADO;

    return this.prisma.post.update({
      where: { id },
      data: {
        ...dto,
        slug: dto.slug ? slugify(dto.slug) : undefined,
        publishedAt: willPublish ? new Date() : post.publishedAt,
      },
    });
  }

  /** Lista publica: somente posts publicados. */
  async listPublished(query: PaginationQueryDto, categorySlug?: string) {
    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLICADO,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.post.count({ where }),
    ]);

    return this.paginated(data, total, query);
  }

  /** Lista admin: todos os status. */
  async listAll(query: PaginationQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        include: {
          category: { select: { id: true, name: true } },
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.post.count(),
    ]);

    return this.paginated(data, total, query);
  }

  async getPublishedBySlug(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: PostStatus.PUBLICADO },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, name: true } },
        comments: {
          where: { approved: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!post) throw new NotFoundException('Post nao encontrado');
    return post;
  }

  async removePost(id: string) {
    await this.getPostById(id);
    await this.prisma.post.delete({ where: { id } });
    return { success: true };
  }

  private async getPostById(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post nao encontrado');
    return post;
  }

  // ----------------------- Comentarios -----------------------

  async addComment(
    postId: string,
    dto: CreateCommentDto,
    user?: AuthUser,
  ) {
    await this.getPostById(postId);
    return this.prisma.comment.create({
      data: {
        postId,
        userId: user?.id,
        authorName: user ? undefined : dto.authorName ?? 'Visitante',
        content: dto.content,
        approved: false, // sempre passa por moderacao
      },
    });
  }

  async listComments(query: PaginationQueryDto, onlyPending?: boolean) {
    const where = onlyPending ? { approved: false } : {};
    const [data, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: {
          post: { select: { id: true, title: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return this.paginated(data, total, query);
  }

  async moderateComment(id: string, dto: ModerateCommentDto) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comentario nao encontrado');
    return this.prisma.comment.update({
      where: { id },
      data: { approved: dto.approved },
    });
  }

  private paginated<T>(data: T[], total: number, query: PaginationQueryDto) {
    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
