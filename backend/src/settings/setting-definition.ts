/**
 * A setting a module contributes to the Core settings store.
 *
 * Core stores and serves values; it does not know what any key means. Modules
 * register their definitions at boot (SettingsService.define), which is what
 * makes a key writable through the admin endpoint. Fields are kept to what is
 * used today; the Settings Registry grows them when a consumer exists
 * (blueprint §7.1).
 */
export interface SettingDefinition {
  /** Row key in the settings table, e.g. `shipping_cost`. Globally unique. */
  key: string
  /** Validation applied by the admin write path. */
  type: 'number' | 'string'
}
