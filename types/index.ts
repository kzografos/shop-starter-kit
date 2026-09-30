// Core wire types (identity, settings, notifications). Module-owned types
// live with their module — the shop's are in app/modules/ecommerce/types.

/**
 * GET /profile — Core columns plus whatever user extensions the backend's
 * `UserExtensionsRegistry` merged in. Core names none of the extension fields;
 * a module declares its own (e.g. `LoyaltyProfileExtension`) and reads it
 * through its own composable.
 */
export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  /** Core `customer` / `admin`, or a module-registered staff role (`accountant`, `stock_manager`, …). */
  role: string
  /** Capabilities resolved for the role by the backend registry. */
  permissions: string[]
  created_at: string
  /** Module-registered user extension fields, snake_cased on the wire. */
  [extension: string]: unknown
}

/** Settings Registry wire shapes (GET /admin/settings). Mirrors backend/src/settings/setting-definition.ts. */
export interface SettingDefinition {
  key: string
  type: 'number' | 'string'
  default: string
  group: string
  label_key: string
  description_key?: string
  order?: number
  public?: boolean
  editable?: boolean
  min?: number
  max?: number
  step?: number
  unit?: string
}
export interface SettingGroup {
  id: string
  label_key: string
  description_key?: string
  icon?: string
  order: number
}
export interface AdminSettingsPayload {
  groups: SettingGroup[]
  definitions: SettingDefinition[]
  values: Record<string, string>
}

export type NotificationType = 'low_stock' | 'out_of_stock' | 'order_status'

/** A row of the signed-in user's notification feed (GET /notifications). */
export interface Notification {
  id: string
  type: NotificationType
  user_id: string | null
  key: string | null
  product_id: string | null
  stock: number | null
  meta: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

/** GET /notifications — one page of the feed plus its unread figure. */
export interface NotificationList {
  items: Notification[]
  total: number
  page: number
  total_pages: number
  unread: number
}
