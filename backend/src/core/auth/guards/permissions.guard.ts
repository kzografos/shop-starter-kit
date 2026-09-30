import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator'
import { OWNER_ROLE, type Capability } from '../permissions'
import { PermissionsRegistryService } from '../permissions.registry.service'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissions: PermissionsRegistryService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    const user = ctx.switchToHttp().getRequest().user
    if (!user?.role) throw new ForbiddenException('Not authenticated')

    // Owner has everything.
    if (user.role === OWNER_ROLE) return true

    // Untagged admin routes are owner-only by default.
    if (!required || required.length === 0) throw new ForbiddenException('Owner only')

    const held = this.permissions.permissionsFor(user.role)
    const ok = required.every((cap) => held.includes(cap))
    if (!ok) throw new ForbiddenException('Insufficient permissions')
    return true
  }
}
