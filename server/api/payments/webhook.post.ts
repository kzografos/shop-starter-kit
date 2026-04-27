import Stripe from 'stripe'
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const stripe = new Stripe(config.stripeSecretKey as string)

  const body = await readRawBody(event)
  const sig = getHeader(event, 'stripe-signature')

  if (!body || !sig) throw createError({ statusCode: 400, message: 'Missing body or signature' })

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(body, sig, config.stripeWebhookSecret as string)
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const { order_id, user_id } = session.metadata ?? {}

    if (!order_id || !user_id) return { received: true }

    const supabase = serverSupabaseServiceRole(event)

    const { data: settings } = await supabase.from('settings').select('key, value')
    const cfg = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]))
    const earnRate = parseInt(cfg.loyalty_earn_rate ?? '100')

    const { data: order } = await supabase
      .from('orders')
      .select('total')
      .eq('id', order_id)
      .single()

    if (order) {
      const pointsEarned = Math.floor(order.total * earnRate)
      await Promise.all([
        supabase.from('orders').update({
          payment_status: 'paid',
          status: 'confirmed',
          stripe_payment_intent_id: session.payment_intent as string,
        }).eq('id', order_id),
        pointsEarned > 0 && supabase.from('loyalty_transactions').insert({
          user_id,
          order_id,
          points_delta: pointsEarned,
          type: 'earn',
        }),
        pointsEarned > 0 && supabase.rpc('adjust_loyalty_points', {
          p_user_id: user_id,
          p_delta: pointsEarned,
        }),
      ])
    }
  }

  return { received: true }
})
