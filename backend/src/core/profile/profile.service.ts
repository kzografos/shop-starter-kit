import { Injectable } from '@nestjs/common'
import { UsersService } from '../users/users.service'
import { UserExtensionsRegistry } from '../users/user-extensions.registry'
import { PermissionsRegistryService } from '../auth/permissions.registry.service'

@Injectable()
export class ProfileService {
  constructor(
    private users: UsersService,
    private extensions: UserExtensionsRegistry,
    private permissions: PermissionsRegistryService,
  ) {}

  async me(user: unknown) {
    const u = (user ?? {}) as { id?: string; role?: string }
    // Module-owned fields (e.g. the loyalty balance) are merged in here; the
    // request user itself carries only Core columns.
    const extended = u.id ? await this.extensions.applyOne({ ...u, id: u.id }, 'profile') : u
    // Expose admin capabilities so the client can gate nav + routes.
    return { ...extended, permissions: this.permissions.permissionsFor(u.role) }
  }

  async update(userId: string, dto: { fullName?: string; phone?: string }) {
    return this.extensions.applyOne(await this.users.updateProfile(userId, dto), 'profile')
  }
}
