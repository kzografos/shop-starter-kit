/**
 * Client-side mirror of the backend capability model (backend is the real
 * enforcer). Drives admin nav visibility, route guards and per-role landing.
 */
type Cap = string

// Path → capability needed to view that admin section.
const SECTION_CAPS: { match: (p: string) => boolean; cap: Cap }[] = [
  { match: (p) => p.includes('/admin/analytics'), cap: 'view:finance' },
  { match: (p) => p.includes('/admin/products'), cap: 'view:catalog' },
  { match: (p) => p.includes('/admin/categories'), cap: 'view:catalog' },
  { match: (p) => p.includes('/admin/orders'), cap: 'view:orders' },
  { match: (p) => p.includes('/admin/customers'), cap: 'view:customers' },
  { match: (p) => p.includes('/admin/newsletter'), cap: 'manage:marketing' },
  { match: (p) => p.includes('/admin/notifications'), cap: 'manage:inventory' },
  { match: (p) => p.includes('/admin/settings'), cap: 'manage:settings' },
  { match: (p) => p.includes('/admin/staff'), cap: 'manage:staff' },
]

// Where each role lands after login — first section it's allowed to see.
const LANDING_ORDER: { cap: Cap; path: string }[] = [
  { cap: 'view:finance', path: '/admin' }, // dashboard
  { cap: 'view:catalog', path: '/admin/products' },
  { cap: 'view:orders', path: '/admin/orders' },
  { cap: 'view:customers', path: '/admin/customers' },
  { cap: 'manage:marketing', path: '/admin/newsletter' },
  { cap: 'manage:inventory', path: '/admin/notifications' },
  { cap: 'manage:settings', path: '/admin/settings' },
  { cap: 'manage:staff', path: '/admin/staff' },
]

export const STAFF_ROLES = ['admin', 'accountant', 'stock_manager']

export function usePermissions() {
  const auth = useAuthStore()
  const permissions = computed<string[]>(() => ((auth.profile as any)?.permissions as string[]) ?? [])
  const role = computed<string>(() => (auth.profile as any)?.role ?? '')
  const isStaff = computed(() => STAFF_ROLES.includes(role.value))
  const can = (cap: Cap) => permissions.value.includes(cap)

  function requiredCapFor(path: string): Cap | null {
    const s = SECTION_CAPS.find((x) => x.match(path))
    if (s) return s.cap
    if (/\/admin\/?$/.test(path)) return 'view:finance' // dashboard root
    return null
  }
  function firstAllowedPath(): string {
    return LANDING_ORDER.find((l) => permissions.value.includes(l.cap))?.path ?? '/'
  }

  return { permissions, role, isStaff, can, requiredCapFor, firstAllowedPath }
}
