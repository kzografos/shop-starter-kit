import type { AdminSectionContribution } from '#core/types/contributions'
import {
  groupAdminSections,
  isActiveAdminSection,
  matchAdminSection,
  validAdminSections,
  visibleAdminSections,
} from '#core/utils/admin-registry'

/**
 * The Admin Registry as the shell sees it: `app.config.adminSections` and
 * `adminGroups`, filtered by the signed-in staff member's capabilities and
 * localised for routing. Core reads it; modules only contribute entries.
 */
export function useAdminRegistry() {
  const appConfig = useAppConfig()
  const route = useRoute()
  const localePath = useLocalePath()
  const { can } = usePermissions()

  const all = computed(() =>
    validAdminSections(appConfig.adminSections, (entry, reason) => {
      if (import.meta.dev) console.warn(`[admin registry] section ignored (${reason}):`, entry)
    }),
  )
  /** Sections the current user may see, sorted. */
  const sections = computed(() => visibleAdminSections(all.value, can))
  /** Visible sections in their groups, empty groups dropped. */
  const groups = computed(() => groupAdminSections(sections.value, appConfig.adminGroups))
  /** The section the current route belongs to (visible or not), or null. */
  const current = computed(() => matchAdminSection(all.value, route.path, localePath))

  const isActive = (section: AdminSectionContribution) => isActiveAdminSection(section, localePath(section.path), route.path)

  return { sections, groups, current, isActive }
}
