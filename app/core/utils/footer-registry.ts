import type { FooterColumnContribution, FooterItemContribution } from '#core/types/contributions'

/**
 * Pure function behind the footer contributions, the counterpart of
 * `admin-registry.ts`: it takes the contributed columns and items and answers
 * the one question the footer shell has — what to render, in what order. No
 * Nuxt, i18n, app.config or API access, so it runs in tests; it knows no
 * column id and no route.
 */
export interface FooterColumn extends FooterColumnContribution {
  items: FooterItemContribution[]
}

/**
 * Columns sorted by `order`, each holding its items sorted by `order`; a
 * column nobody contributed an item to is omitted. An item naming an unknown
 * column joins the first one, the same fallback `groupAdminSections()` uses,
 * so a contribution is never silently dropped.
 */
export function footerColumns(
  columns: readonly FooterColumnContribution[] | undefined,
  items: readonly FooterItemContribution[] | undefined,
): FooterColumn[] {
  const list: FooterColumn[] = [...(columns ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c, items: [] }))
  if (list.length === 0) return []

  const byId = new Map(list.map((c) => [c.id, c]))
  const first = list[0]!
  for (const item of [...(items ?? [])].sort((a, b) => a.order - b.order)) {
    (byId.get(item.column) ?? first).items.push(item)
  }
  return list.filter((c) => c.items.length > 0)
}
