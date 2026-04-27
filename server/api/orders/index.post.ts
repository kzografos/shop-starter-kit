import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { CreateOrderPayload } from '~/types'
import { sendOrderConfirmation } from '~/server/utils/mailer'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = await serverSupabaseClient(event)
  const body = await readBody<CreateOrderPayload>(event)

  const { items, fulfillment_type, payment_method, shipping_address, loyalty_points_to_redeem = 0, notes } = body

  // Validate: shipping requires address
  if (fulfillment_type === 'shipping' && !shipping_address) {
    throw createError({ statusCode: 400, message: 'Shipping address required' })
  }

  // Validate: pickup can't use stripe
  if (fulfillment_type === 'pickup' && payment_method === 'stripe') {
    // Allow stripe for pickup too (pay online, pick up in store)
  }

  // Load settings
  const { data: settings } = await supabase.from('settings').select('key, value')
  const cfg = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))
  const redeemRate = parseInt(cfg.loyalty_redeem_rate ?? '100')
  const shippingCost = parseFloat(cfg.shipping_cost ?? '5.00')
  const freeThreshold = parseFloat(cfg.free_shipping_threshold ?? '50.00')

  // Calculate totals
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const shipping = fulfillment_type === 'pickup' ? 0 : (subtotal >= freeThreshold ? 0 : shippingCost)
  const loyaltyDiscount = loyalty_points_to_redeem > 0 ? loyalty_points_to_redeem / redeemRate : 0
  const total = Math.max(0, subtotal + shipping - loyaltyDiscount)

  // Check user has enough loyalty points
  if (loyalty_points_to_redeem > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('loyalty_points')
      .eq('id', user.id)
      .single()
    if ((profile?.loyalty_points ?? 0) < loyalty_points_to_redeem) {
      throw createError({ statusCode: 400, message: 'Insufficient loyalty points' })
    }
  }

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      fulfillment_type,
      payment_method,
      shipping_address: shipping_address ?? null,
      subtotal,
      shipping_cost: shipping,
      loyalty_discount: loyaltyDiscount,
      total,
      notes: notes ?? null,
      payment_status: payment_method === 'stripe' ? 'pending' : 'pending',
    })
    .select()
    .single()

  if (orderError) throw createError({ statusCode: 500, message: orderError.message })

  // Insert order items (triggers stock decrement)
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(items.map(i => ({ ...i, order_id: order.id })))

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id)
    throw createError({ statusCode: 400, message: itemsError.message })
  }

  // Deduct loyalty points
  if (loyalty_points_to_redeem > 0) {
    await Promise.all([
      supabase.from('loyalty_transactions').insert({
        user_id: user.id,
        order_id: order.id,
        points_delta: -loyalty_points_to_redeem,
        type: 'redeem',
      }),
      supabase.rpc('adjust_loyalty_points', {
        p_user_id: user.id,
        p_delta: -loyalty_points_to_redeem,
      }),
    ])
  }

  // Earn points for this order (on cash/card pickup, immediately; Stripe handled via webhook)
  if (payment_method !== 'stripe') {
    const earnRate = parseInt(cfg.loyalty_earn_rate ?? '100')
    const pointsEarned = Math.floor(total * earnRate)
    if (pointsEarned > 0) {
      await Promise.all([
        supabase.from('loyalty_transactions').insert({
          user_id: user.id,
          order_id: order.id,
          points_delta: pointsEarned,
          type: 'earn',
        }),
        supabase.rpc('adjust_loyalty_points', {
          p_user_id: user.id,
          p_delta: pointsEarned,
        }),
        supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id),
      ])
    }
  }

  // Send order confirmation email (fire-and-forget — don't fail order if email fails)
  ;(async () => {
    const productIds = items.map((i) => i.product_id)
    const { data: products } = await supabase
      .from('products')
      .select('id, name_el')
      .in('id', productIds)
    const nameMap = new Map((products ?? []).map((p: any) => [p.id, p.name_el]))

    await sendOrderConfirmation({
      orderId: order.id,
      customerEmail: user.email!,
      items: items.map((i) => ({
        name: nameMap.get(i.product_id) ?? `#${i.product_id.slice(0, 6)}`,
        quantity: i.quantity,
        unitPrice: i.unit_price,
      })),
      subtotal,
      shippingCost: shipping,
      loyaltyDiscount,
      total,
      fulfillmentType: fulfillment_type,
      shippingAddress: shipping_address ?? null,
    })
  })().catch(console.error)

  return order
})
