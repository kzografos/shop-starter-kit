import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * Like JwtAuthGuard but never throws: if a valid JWT is present the request
 * gets `user`, otherwise `user` is undefined and the request proceeds anyway.
 * Used for endpoints that work for both authenticated users and guests.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context)
    } catch {
      // ignore — anonymous request
    }
    return true
  }

  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    // Never throw on missing/invalid token — just return whatever we have.
    return user
  }
}
