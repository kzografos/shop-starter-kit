import { loadStripe } from '@stripe/stripe-js'

export default defineNuxtPlugin(() => {
  // Preload Stripe.js WITHOUT awaiting — an awaited network call here blocks client
  // hydration. Nothing consumes $stripe synchronously (checkout uses hosted redirect).
  const config = useRuntimeConfig()
  const key = config.public.stripePublishableKey as string | undefined
  const stripe = key ? loadStripe(key).catch(() => null) : Promise.resolve(null)
  return { provide: { stripe } }
})
