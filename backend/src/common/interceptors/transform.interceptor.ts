import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TransformedResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Wraps every successful response into a `{ success, data, meta }` envelope.
 *
 * Responses that are already shaped this way (e.g. paginated results returning
 * `{ items, total }`) are handled transparently — the interceptor detects the
 * `items` key and promotes pagination fields into `meta`.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformedResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        // Paginated payload convention: { items, total, ... }
        if (
          payload &&
          typeof payload === 'object' &&
          'items' in payload &&
          'total' in payload
        ) {
          const { items, total, ...rest } = payload as Record<string, unknown>;
          return {
            success: true,
            data: items as T,
            meta: { total, ...rest },
          };
        }

        return {
          success: true,
          data: payload,
        };
      }),
    );
  }
}
