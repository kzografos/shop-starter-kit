import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import Stripe from 'stripe'

@Injectable()
export class PaymentsService {
  private stripe: Stripe
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.stripe = new Stripe(config.getOrThrow('STRIPE_SECRET_KEY'))
  }

  async createCheckoutSession(orderId: string, userId: string, successUrl: string, cancelUrl: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { include: { product: true } } },
    })
    if (!order) throw new BadRequestException('Order not found')
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

    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = []
    if (Number(order.loyaltyDiscount) > 0) {
      const coupon = await this.stripe.coupons.create({
        amount_off: Math.round(Number(order.loyaltyDiscount) * 100),
        currency: 'eur',
        name: 'Loyalty Points Discount',
      })
      discounts.push({ coupon: coupon.id })
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      discounts,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { order_id: orderId, user_id: userId },
    })

    await this.prisma.order.update({
      where: { id: orderId },
      data: { stripeSessionId: session.id },
    })

    return { url: session.url }
  }

  async verifySession(sessionId: string, userId: string) {
    if (!sessionId) throw new BadRequestException('session_id is required')
    const session = await this.stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.user_id !== userId) throw new BadRequestException('Session not found')
    return { status: session.payment_status }
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const secret = this.config.getOrThrow('STRIPE_WEBHOOK_SECRET')
    let event: Stripe.Event

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret)
    } catch {
      throw new BadRequestException('Invalid webhook signature')
    }

    if (event.type !== 'checkout.session.completed') return { received: true }

    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.order_id
    const userId  = session.metadata?.user_id
    if (!orderId || !userId) return { received: true }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return { received: true }

    // Verify amount paid matches order total
    const paidCents  = session.amount_total ?? 0
    const orderCents = Math.round(Number(order.total) * 100)
    if (paidCents < orderCents) {
      this.logger.error(`Amount mismatch order ${orderId}: paid ${paidCents} expected ${orderCents}`)
      return { received: true }
    }

    const settings = await this.prisma.setting.findMany()
    const earnRate = parseFloat(settings.find((s) => s.key === 'loyalty_earn_rate')?.value ?? '100')
    const pointsEarned = Math.floor(Number(order.total) * earnRate)

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          stripePaymentIntentId: session.payment_intent as string,
        },
      }),
      this.prisma.loyaltyTransaction.create({
        data: { userId, orderId, pointsDelta: pointsEarned, type: 'EARN' },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { loyaltyPoints: { increment: pointsEarned } },
      }),
    ])

    return { received: true }
  }
}
