// E-commerce wire types (catalogue, cart, orders, loyalty). Imported inside
// the layer as `#shop/types`; Core's own types stay in the root `types/`.

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

/** Shop (loyalty module): the field its user extension adds to `/profile`. Read via `useLoyalty()`. */
export interface LoyaltyProfileExtension {
  loyalty_points: number
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
