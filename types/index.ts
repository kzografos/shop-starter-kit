export interface Category {
  id: string
  slug: string
  name_el: string
  name_en: string
  parent_id: string | null
  sort_order: number
  created_at: string
  children?: Category[]
}

export interface Product {
  id: string
  slug: string
  name_el: string
  name_en: string
  description_el: string | null
  description_en: string | null
  price: number
  compare_at_price: number | null
  stock: number
  is_active: boolean
  category_id: string | null
  brand: string | null
  images: string[]
  created_at: string
  updated_at: string
  category?: Category
}

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

/** Shop (loyalty module): the field its user extension adds to `/profile`. Read via `useLoyalty()`. */
export interface LoyaltyProfileExtension {
  loyalty_points: number
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

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready' | 'completed' | 'cancelled'
export type FulfillmentType = 'shipping' | 'pickup'
export type PaymentMethod = 'stripe' | 'cash_on_pickup' | 'card_on_pickup'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface ShippingAddress {
  full_name: string
  address: string
  city: string
  postal_code: string
  phone: string
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

export interface Order {
  id: string
  user_id: string
  status: OrderStatus
  fulfillment_type: FulfillmentType
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  stripe_payment_intent_id: string | null
  subtotal: number
  shipping_cost: number
  loyalty_discount: number
  total: number
  shipping_address: ShippingAddress | null
  notes: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
  /** Customer payloads only: the order is still pending and unpaid, so the customer may cancel it. */
  can_cancel?: boolean
}

export interface OrderItem {
  id: string
  order_id: string
  // Null once the product is deleted — the relation is SetNull.
  product_id: string | null
  quantity: number
  unit_price: number
  // Snapshots taken at order time. These are the historical record and survive
  // the product being deleted or renamed, so they are the fallback whenever
  // `product` is absent.
  product_name: string
  product_price: number
  product?: Product | null
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface LoyaltyTransaction {
  id: string
  user_id: string
  order_id: string | null
  points_delta: number
  type: 'earn' | 'redeem'
  created_at: string
}

export interface CreateOrderPayload {
  items: Array<{ product_id: string; quantity: number; unit_price: number }>
  fulfillment_type: FulfillmentType
  payment_method: PaymentMethod
  shipping_address?: ShippingAddress
  loyalty_points_to_redeem?: number
  notes?: string
}
