/**
 * Capability-based access control for the admin panel.
 *
 * Roles map to a strict set of capabilities. The OWNER (ADMIN) implicitly
 * holds every capability; other staff roles see only what they're granted.
 * Enforced server-side by PermissionsGuard — never trust hidden menus alone.
 */
export const CAPABILITIES = [
  'view:finance', // dashboard revenue + analytics
  'view:orders',
  'manage:orders', // status changes, refunds
  'view:catalog', // products + categories (read)
  'manage:catalog', // products + categories (write) + image upload
  'manage:inventory', // stock, low-stock notifications, suppliers (future)
  'view:customers',
  'manage:marketing', // newsletter, campaigns, coupons (future)
  'manage:settings',
  'manage:staff', // staff accounts + roles
] as const

export type Capability = (typeof CAPABILITIES)[number]

const ALL: Capability[] = [...CAPABILITIES]

// Keyed by the Prisma UserRole enum NAME (uppercase), as seen on req.user.role.
export const ROLE_PERMISSIONS: Record<string, Capability[]> = {
  ADMIN: ALL,
  ACCOUNTANT: ['view:finance', 'view:orders'],
  STOCK_MANAGER: ['view:catalog', 'manage:catalog', 'manage:inventory'],
}

export function permissionsFor(role: string | undefined | null): Capability[] {
  if (!role) return []
  if (role === 'ADMIN') return ALL
  return ROLE_PERMISSIONS[role] ?? []
}

// Roles that may sign into the admin panel at all.
export const STAFF_ROLES = ['ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER'] as const
