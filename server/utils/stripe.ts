import Stripe from 'stripe'

const config = useRuntimeConfig()

export const stripe = new Stripe(config.stripeSecretKey as string, {
  apiVersion: '2025-03-31.basil',
})
