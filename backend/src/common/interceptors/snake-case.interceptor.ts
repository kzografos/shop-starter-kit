import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

const ENUM_FIELDS = new Set([
  'status', 'payment_status', 'fulfillment_type', 'payment_method',
  'type', 'role', 'action',
])

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

function transform(obj: unknown, parentKey?: string): unknown {
  if (obj instanceof Decimal) return obj.toNumber()
  if (obj instanceof Date) return obj
  if (Array.isArray(obj)) return obj.map((item) => transform(item))
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, val]) => {
        const snakeKey = toSnakeCase(key)
        return [snakeKey, transform(val, snakeKey)]
      }),
    )
  }
  if (typeof obj === 'string' && parentKey) {
    if (ENUM_FIELDS.has(parentKey)) return obj.toLowerCase()
  }
  return obj
}

@Injectable()
export class SnakeCaseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => transform(data)))
  }
}
