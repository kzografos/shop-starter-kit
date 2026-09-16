import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import { isPaymentsConfigured } from '../core/config/env.validation'
import {
  CheckoutSession,
  CheckoutStatus,
  CreateCheckoutInput,
  PaymentProvider,
  WebhookEvent,
} from './payment-provider'

@Injectable()
export class StripePaymentProvider extends PaymentProvider {
  // Null when Stripe is not configured; no SDK client is created in that case.
  private readonly stripe: Stripe | null
  private readonly logger = new Logger(StripePaymentProvider.name)

  constructor(private config: ConfigService) {
    super()
    if (isPaymentsConfigured(config)) {
      this.stripe = new Stripe(config.getOrThrow('STRIPE_SECRET_KEY'))
    } else {
      this.stripe = null
      this.logger.warn('Stripe not configured — online payments are unavailable')
    }
  }

  get isEnabled(): boolean {
    return this.stripe !== null
  }

  assertEnabled(): void {
    this.requireStripe()
  }

  // Single choke point: a disabled provider fails clearly before any work.
  private requireStripe(): Stripe {
    if (!this.stripe) throw new ServiceUnavailableException('Online payments are not configured')
    return this.stripe
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const stripe = this.requireStripe()

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: input.currency,
        unit_amount: line.unitAmountMinor,
        product_data: { name: line.name },
      },
    }))

    // Idempotency keys are scoped to the order so a double-click on Place Order
    // reuses the objects the first click created instead of minting duplicates.
    // Stripe retains a key for 24h, which matches the default Checkout Session
    // lifetime, so a retry within that window resumes the same session.
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = []
    if (input.discountMinor > 0) {
      const coupon = await stripe.coupons.create(
        {
          amount_off: input.discountMinor,
          currency: input.currency,
          name: input.discountLabel,
        },
        { idempotencyKey: `loyalty-coupon-${input.orderId}` },
      )
      discounts.push({ coupon: coupon.id })
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: lineItems,
        discounts,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { order_id: input.orderId, user_id: input.userId ?? '' },
      },
      { idempotencyKey: `checkout-session-${input.orderId}` },
    )

    return { id: session.id, url: session.url }
  }

  async getCheckoutStatus(sessionId: string): Promise<CheckoutStatus> {
    const stripe = this.requireStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    return { userId: session.metadata?.user_id || null, status: session.payment_status }
  }

  parseWebhook(rawBody: Buffer, signature: string): WebhookEvent {
    const stripe = this.requireStripe()
    const secret = this.config.getOrThrow('STRIPE_WEBHOOK_SECRET')
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret)
    } catch {
      throw new BadRequestException('Invalid webhook signature')
    }

    if (event.type !== 'checkout.session.completed') {
      return { id: event.id, type: event.type, checkoutCompleted: null }
    }

    const session = event.data.object as Stripe.Checkout.Session
    return {
      id: event.id,
      type: event.type,
      checkoutCompleted: {
        orderId: session.metadata?.order_id ?? null,
        userId: session.metadata?.user_id || null, // empty string = guest order
        amountTotalMinor: session.amount_total ?? null,
        paymentIntentId: session.payment_intent as string,
      },
    }
  }
}
