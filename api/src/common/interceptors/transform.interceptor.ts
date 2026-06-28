import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
}

/**
 * Padroniza a resposta da API. Se o retorno do controller ja possuir
 * a estrutura { data, meta } (resultado paginado), ela e preservada.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload: any) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'meta' in payload
        ) {
          return { success: true, data: payload.data, meta: payload.meta };
        }
        return { success: true, data: payload };
      }),
    );
  }
}
