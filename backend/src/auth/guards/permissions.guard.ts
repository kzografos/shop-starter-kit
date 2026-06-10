import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator'
import { permissionsFor, type Capability } from '../permissions'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    const user = ctx.switchToHttp().getRequest().user
    if (!user?.role) throw new ForbiddenException('Not authenticated')

    // Owner has everything.
    if (user.role === 'ADMIN') return true

    // Untagged admin routes are owner-only by default.
    if (!required || required.length === 0) throw new ForbiddenException('Owner only')

    const held = permissionsFor(user.role)
    const ok = required.every((cap) => held.includes(cap))
    if (!ok) throw new ForbiddenException('Insufficient permissions')
    return true
  }
}
