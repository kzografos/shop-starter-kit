import { Injectable, BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { isPaymentsConfigured } from '../core/config/env.validation'
import Stripe from 'stripe'

@Injectable()
export class PaymentsService {
  // Null when Stripe is not configured; no SDK client is created in that case.
  private readonly stripe: Stripe | null
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mail: MailService,
  ) {
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

  // Single choke point: a disabled provider fails clearly before any DB work.
  private requireStripe(): Stripe {
    if (!this.stripe) throw new ServiceUnavailableException('Online payments are not configured')
    return this.stripe
  }

  async createCheckoutSession(orderId: string, userId: string | null, successUrl: string, cancelUrl: string) {
    const stripe = this.requireStripe()
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    })
    if (!order) throw new BadRequestException('Order not found')
    // Owned orders require the owner; guest orders (userId null) are open to anyone with the id.
    if (order.userId && order.userId !== userId) throw new BadRequestException('Order not found')
    if (order.paymentMethod !== 'STRIPE') throw new BadRequestException('Not a Stripe order')

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(Number(item.unitPrice) * 100),
        product_data: {
          name: item.product?.nameEn ?? 'Product',
        },
      },
    }))

    // Shipping cost as line item
    if (Number(order.shippingCost) > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(Number(order.shippingCost) * 100),
          product_data: { name: 'Shipping' },
        },
      })
    }

    // Idempotency keys are scoped to the order so a double-click on Place Order
    // reuses the objects the first click created instead of minting duplicates.
    // Stripe retains a key for 24h, which matches the default Checkout Session
    // lifetime, so a retry within that window resumes the same session.
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = []
    if (Number(order.loyaltyDiscount) > 0) {
      const coupon = await stripe.coupons.create(
        {
          amount_off: Math.round(Number(order.loyaltyDiscount) * 100),
          currency: 'eur',
          name: 'Loyalty Points Discount',
        },
        { idempotencyKey: `loyalty-coupon-${orderId}` },
      )
      discounts.push({ coupon: coupon.id })
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: lineItems,
        discounts,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { order_id: orderId, user_id: userId ?? '' },
      },
      { idempotencyKey: `checkout-session-${orderId}` },
    )

    await this.prisma.order.update({
      where: { id: orderId },
      data: { stripeSessionId: session.id },
    })

    return { url: session.url }
  }

  async verifySession(sessionId: string, userId: string | null) {
    const stripe = this.requireStripe()
    if (!sessionId) throw new BadRequestException('session_id is required')
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const sessionUserId = session.metadata?.user_id || null
    // Owned sessions require the owner; guest sessions are open to anyone with the id.
    if (sessionUserId && sessionUserId !== userId) throw new BadRequestException('Session not found')
    return { status: session.payment_status }
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const stripe = this.requireStripe()
    const secret = this.config.getOrThrow('STRIPE_WEBHOOK_SECRET')
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret)
    } catch {
      throw new BadRequestException('Invalid webhook signature')
    }

    if (event.type !== 'checkout.session.completed') return { received: true }

    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.order_id
    const userId  = session.metadata?.user_id || null  // empty string = guest order
    if (!orderId) return { received: true }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { email: true } } },
    })
    if (!order) return { received: true }

    // Cheap guard: an order already settled must never be settled twice, whatever
    // event id carried the news. The authoritative guard is the ProcessedEvent
    // insert below, which also covers concurrent deliveries.
    if (order.paymentStatus === 'PAID') {
      this.logger.log(`Order ${orderId} is already paid — ignoring event ${event.id}`)
      return { received: true }
    }

    // Verify amount paid matches order total
    const paidCents  = session.amount_total ?? 0
    const orderCents = Math.round(Number(order.total) * 100)
    if (paidCents < orderCents) {
      this.logger.error(`Amount mismatch order ${orderId}: paid ${paidCents} expected ${orderCents}`)
      return { received: true }
    }

    // Always confirm the order. Award loyalty only for logged-in buyers.
    //
    // The ProcessedEvent insert leads the transaction. Its primary key is the
    // event id, so a duplicate delivery raises a unique violation and rolls back
    // every write behind it. This is what makes the handler safe against Stripe
    // redelivering after a timeout, and against two deliveries racing.
    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.processedEvent.create({
        data: { eventId: event.id, eventType: event.type, orderId },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          stripePaymentIntentId: session.payment_intent as string,
        },
      }),
    ]

    if (userId) {
      const settings = await this.prisma.setting.findMany()
      const earnRate = parseFloat(settings.find((s) => s.key === 'loyalty_earn_rate')?.value ?? '100')
      const pointsEarned = Math.floor(Number(order.total) * earnRate)
      writes.push(
        this.prisma.loyaltyTransaction.create({
          data: { userId, orderId, pointsDelta: pointsEarned, type: 'EARN' },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { loyaltyPoints: { increment: pointsEarned } },
        }),
      )
    }

    try {
      await this.prisma.$transaction(writes)
    } catch (err) {
      // P2002 = unique constraint violation on processed_events.event_id.
      // Another delivery of this same event already applied it; the transaction
      // rolled back, so nothing was written twice. This is a success, not a fault.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(`Event ${event.id} already processed — duplicate ignored`)
        return { received: true }
      }
      throw err
    }

    // Payment has cleared and the writes are committed, so this is the first
    // point at which "your order is confirmed" is true for a Stripe order.
    // Fire-and-forget, matching how OrdersService sends the pickup-order mail:
    // a mail outage must not fail the webhook and trigger a Stripe retry.
    const recipient = order.user?.email ?? order.guestEmail
    if (recipient) {
      this.mail.sendOrderConfirmation(recipient, orderId).catch(() => null)
    } else {
      this.logger.warn(`Order ${orderId} has no email address — no confirmation sent`)
    }

    return { received: true }
  }
}
