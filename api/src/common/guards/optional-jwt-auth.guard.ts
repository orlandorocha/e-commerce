import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Tenta autenticar via JWT, mas não bloqueia a requisição se não houver token.
 * Útil para rotas que funcionam tanto para usuários logados quanto visitantes
 * (ex.: carrinho).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(_err: any, user: any) {
    // Nunca lança: retorna o usuário se existir, ou undefined.
    return user || undefined;
  }
}
