import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { orderConfirmationMail } from '../orders/order-confirmation.mail'
import { PricingSettingsService } from '../orders/pricing-settings.service'
import { OrdersService } from '../orders/orders.service'
import { OrderNotificationsService } from '../orders/order-notifications.service'
import { LoyaltyService } from '../loyalty/loyalty.service'
import { AnalyticsService } from '../analytics/analytics.service'
import { afterCommit } from '../common/utils/after-commit'
import { CheckoutExpired, CheckoutLine, PaymentProvider } from '../payments-provider/payment-provider'

/**
 * Order-side orchestration of online payments. Which PSP is behind it, how a
 * checkout session or a signed webhook looks on the wire, lives in the
 * PaymentProvider (payments-provider/); this service owns the order checks,
 * the line shaping and the settlement transaction.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private prisma: PrismaService,
    private provider: PaymentProvider,
    private mail: MailService,
    private pricing: PricingSettingsService,
    private loyalty: LoyaltyService,
    private orders: OrdersService,
    private orderNotifications: OrderNotificationsService,
    private analytics: AnalyticsService,
  ) {}

  get isEnabled(): boolean {
    return this.provider.isEnabled
  }

  async createCheckoutSession(orderId: string, userId: string | null, successUrl: string, cancelUrl: string) {
    // A disabled provider fails clearly before any DB work.
    this.provider.assertEnabled()
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    })
    if (!order) throw new BadRequestException('Order not found')
    // Owned orders require the owner; guest orders (userId null) are open to anyone with the id.
    if (order.userId && order.userId !== userId) throw new BadRequestException('Order not found')
    if (order.paymentMethod !== 'STRIPE') throw new BadRequestException('Not a Stripe order')

    const lines: CheckoutLine[] = order.items.map((item) => ({
      name: item.product?.nameEn ?? 'Product',
      unitAmountMinor: Math.round(Number(item.unitPrice) * 100),
      quantity: item.quantity,
    }))

    // Shipping cost as line item
    if (Number(order.shippingCost) > 0) {
      lines.push({
        name: 'Shipping',
        unitAmountMinor: Math.round(Number(order.shippingCost) * 100),
        quantity: 1,
      })
    }

    const session = await this.provider.createCheckout({
      orderId,
      userId,
      lines,
      discountMinor: Number(order.loyaltyDiscount) > 0 ? Math.round(Number(order.loyaltyDiscount) * 100) : 0,
      discountLabel: 'Loyalty Points Discount',
      currency: 'eur',
      successUrl,
      cancelUrl,
    })

    await this.prisma.order.update({
      where: { id: orderId },
      data: { stripeSessionId: session.id },
    })

    return { url: session.url }
  }

  async verifySession(sessionId: string, userId: string | null) {
    this.provider.assertEnabled()
    if (!sessionId) throw new BadRequestException('session_id is required')
    const session = await this.provider.getCheckoutStatus(sessionId)
    // Owned sessions require the owner; guest sessions are open to anyone with the id.
    if (session.userId && session.userId !== userId) throw new BadRequestException('Session not found')
    return { status: session.status }
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    // Signature verification and payload parsing are the provider's; a bad
    // signature is a 400, an unconfigured provider a 503, both before any DB work.
    const event = this.provider.parseWebhook(rawBody, signature)
    if (event.checkoutExpired) return this.handleCheckoutExpired(event.id, event.type, event.checkoutExpired)
    if (!event.checkoutCompleted) return { received: true }

    const { orderId, userId, amountTotalMinor, paymentIntentId } = event.checkoutCompleted
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

    // A cancelled order has already been restocked; confirming it now would
    // resurrect it. The payment that came in is left for a manual refund.
    if (order.status === 'CANCELLED') {
      this.logger.warn(`Order ${orderId} was cancelled before payment completed — event ${event.id} ignored, refund manually`)
      return { received: true }
    }

    // Verify amount paid matches order total
    const paidCents  = amountTotalMinor ?? 0
    const orderCents = Math.round(Number(order.total) * 100)
    if (paidCents < orderCents) {
      this.logger.error(`Amount mismatch order ${orderId}: paid ${paidCents} expected ${orderCents}`)
      return { received: true }
    }

    // Always confirm the order. Award loyalty only for logged-in buyers.
    //
    // The ProcessedEvent insert leads the transaction. Its primary key is the
    // event id, so a duplicate delivery raises a unique violation and rolls back
    // every write behind it. This is what makes the handler safe against the
    // provider redelivering after a timeout, and against two deliveries racing.
    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.processedEvent.create({
        data: { eventId: event.id, eventType: event.type, subjectId: orderId },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          stripePaymentIntentId: paymentIntentId,
        },
      }),
    ]

    if (userId) {
      // Same source and same fail-loud rule as order creation: a missing or
      // non-numeric rate throws before anything below is written, so the
      // provider retries the event once the store is configured.
      const { loyalty_earn_rate: earnRate } = await this.pricing.loadPricing()
      const pointsEarned = Math.floor(Number(order.total) * earnRate)
      writes.push(...this.loyalty.earnWrites(this.prisma, userId, orderId, pointsEarned))
    }

    // The customer's "order confirmed" notification rides the same transaction
    // as the confirmation. The order row, not the session, says who owns it.
    const notify = this.orderNotifications.statusWrite(this.prisma, order, 'CONFIRMED')
    if (notify) writes.push(notify)

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
    await this.orderNotifications.invalidate(order)
    // The order just became PAID, which is what every report counts. Same
    // owner and same detached post-commit call as order creation and
    // cancellation in OrdersService; only this path reaches it — duplicates,
    // already-paid orders, mismatches and failed transactions returned above.
    afterCommit(this.logger, `Order ${orderId} analytics invalidation`, () => this.analytics.invalidate())

    // Payment has cleared and the writes are committed, so this is the first
    // point at which "your order is confirmed" is true for a Stripe order.
    // Detached, matching how OrdersService sends the pickup-order mail: a
    // mail outage must not fail the webhook and trigger a provider retry.
    const recipient = order.user?.email ?? order.guestEmail
    if (recipient) {
      afterCommit(this.logger, `Order ${orderId} confirmation email`, () =>
        this.mail.sendMail(orderConfirmationMail(this.mail, recipient, orderId), 'Order confirmation email'),
      )
    } else {
      this.logger.warn(`Order ${orderId} has no email address — no confirmation sent`)
    }

    return { received: true }
  }

  /**
   * An abandoned online checkout: the session expired without payment, so the
   * stock the order reserved goes back on the shelf through the one
   * cancellation path. Only a PENDING, unpaid Stripe order is released; an
   * order that was paid, moved on or already cancelled is left alone, so the
   * event can never resurrect or double-cancel anything, whatever order the
   * provider delivers events in. The status transition inside cancel() is the
   * idempotency guard; the ProcessedEvent row is the delivery ledger and is
   * written after the order is released, so a crash in between just makes the
   * retry a no-op.
   */
  private async handleCheckoutExpired(eventId: string, eventType: string, expired: CheckoutExpired) {
    const { orderId } = expired
    if (!orderId) return { received: true }

    if (await this.prisma.processedEvent.findUnique({ where: { eventId } })) {
      this.logger.log(`Event ${eventId} already processed — duplicate ignored`)
      return { received: true }
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentStatus: true, paymentMethod: true },
    })
    if (!order) return { received: true }

    if (order.paymentMethod !== 'STRIPE' || order.paymentStatus === 'PAID' || order.status !== 'PENDING') {
      this.logger.log(
        `Order ${orderId} is ${order.status.toLowerCase()}/${order.paymentStatus.toLowerCase()} — expired checkout ${eventId} ignored`,
      )
      return { received: true }
    }

    try {
      await this.orders.cancel(orderId, `checkout expired (${eventId})`)
    } catch (err) {
      // Someone (admin cancel, a concurrent delivery, a payment that landed
      // first) moved the order between our read and the cancel: nothing to do.
      if (err instanceof BadRequestException || err instanceof ConflictException) {
        this.logger.log(`Order ${orderId} changed before release — expired checkout ${eventId} ignored`)
        return { received: true }
      }
      throw err
    }

    try {
      await this.prisma.processedEvent.create({ data: { eventId, eventType, subjectId: orderId } })
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
    }
    return { received: true }
  }
}
