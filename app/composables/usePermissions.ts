import { firstAllowedAdminPath, requiredAdminCapability, validAdminSections } from '~/utils/admin-registry'

/**
 * Client-side mirror of the backend capability model (the backend is the real
 * enforcer; this only decides what to show). Which admin section needs which
 * capability comes from the Admin Registry (`app.config.adminSections`), so
 * nothing here names a module.
 */
type Cap = string

export function usePermissions() {
  const auth = useAuthStore()
  const appConfig = useAppConfig()
  const permissions = computed<string[]>(() => auth.profile?.permissions ?? [])
  const role = computed<string>(() => auth.profile?.role ?? '')
  // Staff = someone the backend resolved capabilities for (the owner holds
  // them all). The role vocabulary itself is module-fed and not repeated here.
  const isStaff = computed(() => role.value === 'admin' || permissions.value.length > 0)
  const can = (cap: Cap) => permissions.value.includes(cap)

  const sections = computed(() => validAdminSections(appConfig.adminSections))

  /** Capability a (localised) admin path needs for visibility, or null when no section claims it. */
  function requiredCapFor(path: string): Cap | null {
    return requiredAdminCapability(sections.value, stripLocale(path))
  }
  /** Unlocalised landing path after login: the first registered section this user may see. */
  function firstAllowedPath(): string {
    return firstAllowedAdminPath(sections.value, can, '/')
  }

  return { permissions, role, isStaff, can, requiredCapFor, firstAllowedPath }
}

/** `/en/admin/orders` → `/admin/orders` (registry paths are unlocalised). */
function stripLocale(path: string): string {
  return path.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/'
}
