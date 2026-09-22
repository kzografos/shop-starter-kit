/**
 * Settings Registry contract (blueprint §7.1, docs/SETTINGS-REGISTRY.md).
 *
 * A module describes each setting it owns; Core stores the values, applies
 * the defaults, validates writes, serves the public subset and hands the
 * definitions to the admin form. Core knows nothing about what a key means.
 * Fields are kept to what the application uses today.
 */
export interface SettingDefinition {
  /** Row key in the settings table, e.g. `shipping_cost`. Globally unique. */
  key: string
  /** Value type: validation on write, parsing on public read. */
  type: 'number' | 'string'
  /** Stored form of the default, applied when no row exists. The one authoritative default. */
  default: string
  /** Group id (see SettingGroupDefinition); the admin form renders one card per group. */
  group: string
  /** i18n key of the field label. */
  labelKey: string
  /** i18n key of the hint under the field. */
  descriptionKey?: string
  /** Sort key inside the group. */
  order?: number
  /** Served by the public read (`GET /settings`). Default false — private unless a module says otherwise. */
  public?: boolean
  /** Writable through the admin endpoint. Default true. */
  editable?: boolean
  /** Number constraints, enforced on write and mirrored by the form's input attributes. */
  min?: number
  max?: number
  step?: number
  /** Display unit shown next to the label (`€`). */
  unit?: string
}

/** A card of the admin settings form. */
export interface SettingGroupDefinition {
  id: string
  labelKey: string
  descriptionKey?: string
  /** Icon name from the admin shell's icon set. */
  icon?: string
  order: number
}
