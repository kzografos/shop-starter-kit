import { SetMetadata } from '@nestjs/common'
import type { Capability } from '../permissions'

export const PERMISSIONS_KEY = 'required_permissions'

/**
 * Tag a route (or controller) with the capabilities required to access it.
 * Used together with PermissionsGuard. Untagged routes are OWNER-only.
 */
export const RequirePermissions = (...caps: Capability[]) => SetMetadata(PERMISSIONS_KEY, caps)
