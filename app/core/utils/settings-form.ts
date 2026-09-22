import type { AdminSettingsPayload, SettingDefinition, SettingGroup } from '~~/types'

/**
 * Pure helpers behind the registry-driven admin settings form: which fields
 * to render, in which cards, what the form state starts as and what goes
 * back to the API. No Nuxt access, so they run in `pnpm test`.
 */

export type SettingFormValue = number | string

/** Definitions the form can render (known type, non-empty key), in payload order. */
export function renderableDefinitions(defs: readonly SettingDefinition[] | undefined): SettingDefinition[] {
  return (defs ?? []).filter((d) => d && typeof d.key === 'string' && d.key.length > 0 && (d.type === 'number' || d.type === 'string'))
}

export interface SettingsCard extends SettingGroup {
  fields: SettingDefinition[]
}

/**
 * Renderable definitions arranged into their groups, in group order; a
 * definition naming an unknown group lands in a trailing card with the
 * group id as its label key; empty cards are omitted.
 */
export function settingsCards(payload: Pick<AdminSettingsPayload, 'groups' | 'definitions'> | null | undefined): SettingsCard[] {
  if (!payload) return []
  const cards: SettingsCard[] = [...(payload.groups ?? [])].sort((a, b) => a.order - b.order).map((g) => ({ ...g, fields: [] }))
  const byId = new Map(cards.map((c) => [c.id, c]))
  for (const d of renderableDefinitions(payload.definitions)) {
    let card = byId.get(d.group)
    if (!card) { card = { id: d.group, label_key: d.group, order: Number.MAX_SAFE_INTEGER, fields: [] }; byId.set(d.group, card); cards.push(card) }
    card.fields.push(d)
  }
  for (const c of cards) c.fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.key.localeCompare(b.key))
  return cards.filter((c) => c.fields.length > 0)
}

/** Initial form state: the payload's value (stored or default) typed per definition. */
export function initialFormValues(payload: Pick<AdminSettingsPayload, 'definitions' | 'values'> | null | undefined): Record<string, SettingFormValue> {
  const out: Record<string, SettingFormValue> = {}
  for (const d of renderableDefinitions(payload?.definitions)) {
    const raw = payload?.values?.[d.key] ?? d.default
    out[d.key] = d.type === 'number' ? Number(raw) : raw
  }
  return out
}

/** The PATCH body: editable, renderable keys only, numbers as numbers. */
export function patchBody(defs: readonly SettingDefinition[] | undefined, form: Record<string, SettingFormValue>): Record<string, SettingFormValue> {
  const out: Record<string, SettingFormValue> = {}
  for (const d of renderableDefinitions(defs)) {
    if (d.editable === false || !(d.key in form)) continue
    out[d.key] = form[d.key]!
  }
  return out
}
