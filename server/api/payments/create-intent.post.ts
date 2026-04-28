import Stripe from 'stripe'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody<{ amount_cents: number; order_id: string }>(event)
  const { amount_cents, order_id } = body

  if (!amount_cents || amount_cents <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid amount' })
  }

  const config = useRuntimeConfig()
  const stripe = new Stripe(config.stripeSecretKey as string)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount_cents,
    currency: 'eur',
    metadata: { user_id: user.sub, order_id },
  })

  return { clientSecret: paymentIntent.client_secret }
})
