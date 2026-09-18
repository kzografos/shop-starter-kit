import type { AdminGroupContribution, AdminSectionContribution } from '~/types/contributions'

/**
 * Pure functions behind the Admin Registry. They take the contribution lists
 * and a `can(capability)` predicate and answer the shell's questions: which
 * sections to show, in what groups, which one the current route belongs to,
 * where a staff member lands. No Nuxt or store access, so they run in tests.
 */

export type CanFn = (capability: string) => boolean

const REQUIRED: (keyof AdminSectionContribution)[] = ['id', 'path', 'labelKey', 'icon', 'capability']

/**
 * Entries that are complete and enabled, sorted by `order` then id. A
 * malformed entry (missing id/path/labelKey/icon/capability, or a path not
 * under /admin) is dropped and reported once through `onInvalid` — the shell
 * must never break because one module registered a bad section.
 */
export function validAdminSections(
  entries: readonly AdminSectionContribution[] | undefined,
  onInvalid?: (entry: unknown, reason: string) => void,
): AdminSectionContribution[] {
  const seen = new Set<string>()
  const out: AdminSectionContribution[] = []
  for (const e of entries ?? []) {
    const missing = REQUIRED.filter((k) => typeof e?.[k] !== 'string' || (e[k] as string).length === 0)
    if (missing.length) { onInvalid?.(e, `missing ${missing.join(', ')}`); continue }
    if (!e.path.startsWith('/admin')) { onInvalid?.(e, `path must start with /admin: ${e.path}`); continue }
    if (seen.has(e.id)) { onInvalid?.(e, `duplicate id: ${e.id}`); continue }
    if (e.enabled === false) continue
    seen.add(e.id)
    out.push(e)
  }
  return out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
}

/** The sections a staff member may see. */
export function visibleAdminSections(sections: readonly AdminSectionContribution[], can: CanFn): AdminSectionContribution[] {
  return sections.filter((s) => can(s.capability))
}

export interface AdminSectionGroup extends AdminGroupContribution {
  sections: AdminSectionContribution[]
}

/**
 * Sections arranged into their groups, in group order; groups with no visible
 * section are omitted. A section naming an unknown group, or none, joins the
 * first group (or a synthetic `main` group when no groups are declared).
 */
export function groupAdminSections(
  sections: readonly AdminSectionContribution[],
  groups: readonly AdminGroupContribution[] | undefined,
): AdminSectionGroup[] {
  const declared = [...(groups ?? [])].sort((a, b) => a.order - b.order)
  const list: AdminSectionGroup[] = (declared.length ? declared : [{ id: 'main', order: 0 }]).map((g) => ({ ...g, sections: [] }))
  const byId = new Map(list.map((g) => [g.id, g]))
  const first = list[0]!
  for (const s of sections) (byId.get(s.group ?? '') ?? first).sections.push(s)
  return list.filter((g) => g.sections.length > 0)
}

/** Whether `routePath` (already localised) belongs to `section` (whose path is localised by the caller). */
export function isActiveAdminSection(section: AdminSectionContribution, sectionPath: string, routePath: string): boolean {
  const route = routePath.replace(/\/+$/, '') || '/'
  const own = sectionPath.replace(/\/+$/, '') || '/'
  if (section.activeMatch === 'exact') return route === own
  return route === own || route.startsWith(own + '/')
}

/**
 * The section a path belongs to: the longest matching path wins, and an
 * `exact` section only matches its own path — so `/admin` (exact) does not
 * swallow `/admin/products`. `localize` maps a registry path to the route form.
 */
export function matchAdminSection(
  sections: readonly AdminSectionContribution[],
  routePath: string,
  localize: (path: string) => string = (p) => p,
): AdminSectionContribution | null {
  let best: AdminSectionContribution | null = null
  let bestLen = -1
  for (const s of sections) {
    const own = localize(s.path)
    if (!isActiveAdminSection(s, own, routePath)) continue
    if (own.length > bestLen) { best = s; bestLen = own.length }
  }
  return best
}

/** Capability a path requires for visibility, or null when no section claims it. */
export function requiredAdminCapability(
  sections: readonly AdminSectionContribution[],
  routePath: string,
  localize?: (path: string) => string,
): string | null {
  return matchAdminSection(sections, routePath, localize)?.capability ?? null
}

/** Where a staff member lands: the first section (by order) they may see, or `fallback`. */
export function firstAllowedAdminPath(sections: readonly AdminSectionContribution[], can: CanFn, fallback = '/'): string {
  return visibleAdminSections(sections, can)[0]?.path ?? fallback
}
