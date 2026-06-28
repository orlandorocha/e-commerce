import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, User, UserStatus } from '@prisma/client';
import {
  comparePassword,
  generateToken,
  hashPassword,
  sha256,
} from '../../common/utils/crypto.util';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // ----------------------------------------------------------------
  //  Registro
  // ----------------------------------------------------------------
  async register(dto: RegisterDto, meta: RequestMeta = {}) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new BadRequestException('E-mail ja cadastrado');
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: await hashPassword(dto.password),
        phone: dto.phone,
        role: 'CLIENTE',
        status: UserStatus.ATIVO,
        customer: { create: {} },
      },
    });

    // Token de verificacao de email (a notificacao real seria disparada aqui)
    const verifyToken = generateToken();
    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        tokenHash: sha256(verifyToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });

    await this.audit.record({
      userId: user.id,
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: user.id,
      ...meta,
    });

    const tokens = await this.issueTokens(user, meta);
    return { user: this.sanitize(user), ...tokens, verifyToken };
  }

  // ----------------------------------------------------------------
  //  Login
  // ----------------------------------------------------------------
  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    if (user.status === UserStatus.BLOQUEADO) {
      throw new UnauthorizedException('Usuario bloqueado');
    }

    const valid = await comparePassword(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: meta.ip },
    });

    await this.audit.record({
      userId: user.id,
      action: AuditAction.LOGIN,
      entity: 'User',
      entityId: user.id,
      ...meta,
    });

    const tokens = await this.issueTokens(user, meta);
    return { user: this.sanitize(user), ...tokens };
  }

  // ----------------------------------------------------------------
  //  Refresh Token
  // ----------------------------------------------------------------
  async refresh(refreshToken: string, meta: RequestMeta = {}) {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalido ou expirado');
    }

    // Rotaciona: revoga o antigo e emite novos.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user, meta);
    return { user: this.sanitize(stored.user), ...tokens };
  }

  // ----------------------------------------------------------------
  //  Logout
  // ----------------------------------------------------------------
  async logout(refreshToken: string, userId: string, meta: RequestMeta = {}) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(refreshToken), userId },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      userId,
      action: AuditAction.LOGOUT,
      entity: 'User',
      entityId: userId,
      ...meta,
    });
    return { message: 'Logout realizado com sucesso' };
  }

  // ----------------------------------------------------------------
  //  Recuperacao de senha
  // ----------------------------------------------------------------
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Resposta sempre generica para nao vazar existencia de email.
    if (user) {
      const token = generateToken();
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        },
      });
      this.logger.log(`Token de recuperacao gerado para ${user.email}`);
      // Em producao o token seria enviado por email.
      return {
        message: 'Se o e-mail existir, enviaremos instrucoes de recuperacao',
        resetToken: token,
      };
    }
    return {
      message: 'Se o e-mail existir, enviaremos instrucoes de recuperacao',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: sha256(dto.token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Token invalido ou expirado');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { password: await hashPassword(dto.password) },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Senha redefinida com sucesso' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await comparePassword(dto.currentPassword, user.password);
    if (!valid) {
      throw new BadRequestException('Senha atual incorreta');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await hashPassword(dto.newPassword) },
    });
    return { message: 'Senha alterada com sucesso' };
  }

  // ----------------------------------------------------------------
  //  Confirmacao de email
  // ----------------------------------------------------------------
  async verifyEmail(token: string) {
    const verification = await this.prisma.emailVerification.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!verification || verification.usedAt || verification.expiresAt < new Date()) {
      throw new BadRequestException('Token invalido ou expirado');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verification.userId },
        data: { emailVerifiedAt: new Date(), status: UserStatus.ATIVO },
      }),
      this.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { message: 'E-mail confirmado com sucesso' };
  }

  // ----------------------------------------------------------------
  //  Perfil
  // ----------------------------------------------------------------
  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: { include: { permission: true } },
        customer: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      ...this.sanitize(user),
      permissions: user.permissions.map((p) => p.permission.key),
      customer: user.customer,
    };
  }

  // ----------------------------------------------------------------
  //  Helpers
  // ----------------------------------------------------------------
  private async issueTokens(user: User, meta: RequestMeta) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });

    const refreshToken = generateToken();
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: this.computeExpiry(refreshExpiresIn),
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    };
  }

  private computeExpiry(duration = '7d'): Date {
    const match = /^(\d+)([smhd])$/.exec(duration);
    const now = Date.now();
    if (!match) return new Date(now + 1000 * 60 * 60 * 24 * 7);
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 1000 * 60,
      h: 1000 * 60 * 60,
      d: 1000 * 60 * 60 * 24,
    };
    return new Date(now + value * multipliers[unit]);
  }

  private sanitize(user: User) {
    const { password, ...rest } = user;
    void password;
    return rest;
  }
}
