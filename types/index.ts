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

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  loyalty_points: number
  role: 'customer' | 'admin'
  created_at: string
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
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  product?: Product
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
