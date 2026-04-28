import Stripe from 'stripe'
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { order_id } = await readBody<{ order_id: string }>(event)
  if (!order_id) throw createError({ statusCode: 400, message: 'order_id required' })

  const supabase = await serverSupabaseClient(event)
  const config = useRuntimeConfig()

  // Fetch order + items with product names
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, items:order_items(quantity, unit_price, product:products(name_el, name_en))')
    .eq('id', order_id)
    .eq('user_id', user.sub)
    .single()

  if (orderErr || !order) throw createError({ statusCode: 404, message: 'Order not found' })

  const stripe = new Stripe(config.stripeSecretKey as string)
  const origin = getHeader(event, 'origin') || 'https://localhost:3000'

  // Build line items
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item: any) => ({
    price_data: {
      currency: 'eur',
      product_data: { name: item.product.name_el ?? item.product.name_en },
      unit_amount: Math.round(item.unit_price * 100),
    },
    quantity: item.quantity,
  }))

  if (order.shipping_cost > 0) {
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: 'Κόστος Αποστολής / Shipping' },
        unit_amount: Math.round(order.shipping_cost * 100),
      },
      quantity: 1,
    })
  }

  // Loyalty discount as coupon
  const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = []
  if (order.loyalty_discount > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: Math.round(order.loyalty_discount * 100),
      currency: 'eur',
      duration: 'once',
    })
    discounts.push({ coupon: coupon.id })
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    customer_email: user.email ?? undefined,
    discounts: discounts.length ? discounts : undefined,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel?order_id=${order_id}`,
    metadata: {
      order_id,
      user_id: user.sub,
    },
  })

  return { url: session.url }
})
