import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { orderConfirmationMail } from './order-confirmation.mail'
import { StockAlertsService } from '../products/stock-alerts.service'
import { PricingSettingsService } from './pricing-settings.service'
import { LoyaltyService } from '../loyalty/loyalty.service'
import { AnalyticsService } from '../analytics/analytics.service'
import { StorageAdapter } from '../storage/storage-adapter'
import { CreateOrderDto } from './dto/create-order.dto'
import { Decimal } from '@prisma/client/runtime/library'
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  pending: PaymentStatus.PENDING,
  paid: PaymentStatus.PAID,
  failed: PaymentStatus.FAILED,
  refunded: PaymentStatus.REFUNDED,
}

// A search term made only of hex digits and dashes is treated as an order-id
// prefix. Anchored and length-capped so it cannot be used to smuggle anything
// into the LIKE pattern below.
const UUID_PREFIX = /^[0-9a-f-]{1,36}$/i

const STATUS_MAP: Record<string, OrderStatus> = {
  pending: OrderStatus.PENDING,
  confirmed: OrderStatus.CONFIRMED,
  processing: OrderStatus.PROCESSING,
  ready: OrderStatus.READY,
  completed: OrderStatus.COMPLETED,
  cancelled: OrderStatus.CANCELLED,
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private stockAlerts: StockAlertsService,
    private pricing: PricingSettingsService,
    private loyalty: LoyaltyService,
    private analytics: AnalyticsService,
    private storage: StorageAdapter,
  ) {}

  async create(userId: string | null, userEmail: string | null, dto: CreateOrderDto) {
    // Guest checkout: must supply an email for the order confirmation.
    const guestEmail = userId ? null : dto.guestEmail
    if (!userId && !guestEmail)
      throw new BadRequestException('Email is required to place an order as a guest')
    const confirmationEmail = userEmail ?? guestEmail!
    // Capture as const so TS narrows it inside the transaction closure below.
    const uid = userId

    // Load settings. Throws if any pricing key is missing or non-numeric rather
    // than letting NaN propagate into subtotal, shipping and total.
    const s = await this.pricing.loadPricing()

    // Load user for loyalty check (logged-in only)
    const user = userId
      ? await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
      : null

    // Validate loyalty points — guests cannot redeem
    const pointsToRedeem = user ? (dto.loyaltyPointsToRedeem ?? 0) : 0
    if (pointsToRedeem > 0) {
      if (pointsToRedeem < s.loyalty_min_redeem)
        throw new BadRequestException(`Minimum ${s.loyalty_min_redeem} points to redeem`)
      if (pointsToRedeem > (await this.loyalty.balance(user!.id)))
        throw new BadRequestException('Insufficient loyalty points')
    }

    // Load products and verify stock + prices
    const productIds = dto.items.map((i) => i.productId)
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    })

    if (products.length !== productIds.length)
      throw new BadRequestException('One or more products not found or inactive')

    // Calculate server-side totals
    let subtotal = 0
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId)!
      subtotal += Number(product.price) * item.quantity
    }

    const shippingCost =
      dto.fulfillmentType === 'PICKUP' ? 0
      : subtotal >= s.free_shipping_threshold ? 0
      : s.shipping_cost

    const loyaltyDiscount = pointsToRedeem / s.loyalty_redeem_rate
    const total = Math.max(0, subtotal + shippingCost - loyaltyDiscount)

    // Create order + items + loyalty in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          guestEmail,
          fulfillmentType: dto.fulfillmentType,
          paymentMethod: dto.paymentMethod,
          subtotal,
          shippingCost,
          loyaltyDiscount,
          total,
          shippingAddress: dto.shippingAddress ? { ...dto.shippingAddress } : undefined,
          notes: dto.notes,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      })

      // Decrement stock + create items
      for (const item of dto.items) {
        const product = products.find((p) => p.id === item.productId)!
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        })
        if (updated.count === 0)
          throw new BadRequestException(`Insufficient stock for: ${product.nameEn}`)

        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: Number(product.price),
            productName: product.nameEl || product.nameEn,
            productPrice: Number(product.price),
          },
        })
      }

      // Loyalty: redeem (logged-in only — guests can't redeem)
      if (uid && pointsToRedeem > 0) {
        await this.loyalty.redeem(tx, uid, newOrder.id, pointsToRedeem)
      }

      // Non-Stripe orders are settled immediately (cash/card on pickup).
      // Stripe orders are confirmed on webhook instead.
      if (dto.paymentMethod !== 'STRIPE') {
        // Loyalty: earn (logged-in only — Stripe earns on webhook)
        if (uid) {
          const pointsEarned = Math.floor(total * s.loyalty_earn_rate)
          await this.loyalty.earn(tx, uid, newOrder.id, pointsEarned)
        }
        await tx.order.update({
          where: { id: newOrder.id },
          data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
        })
      }

      return newOrder
    })

    // Only cash/card-on-pickup orders are settled here. A Stripe order is still
    // unpaid at this point, so its confirmation is sent from the webhook once
    // payment actually clears -- otherwise abandoning checkout still produced a
    // "your order has been confirmed" email.
    if (dto.paymentMethod !== 'STRIPE') {
      this.mail
        .sendMail(orderConfirmationMail(this.mail, confirmationEmail, order.id), 'Order confirmation email')
        .catch(() => null)
    }
    // A new order changes every report; fire-and-forget through the owner.
    this.analytics.invalidate().catch(() => null)

    // Fire-and-forget low-stock alerts for the products we just decremented.
    for (const item of dto.items) {
      const p = products.find((x) => x.id === item.productId)
      if (p)
        this.stockAlerts
          .checkStock({ id: p.id, stock: p.stock - item.quantity, nameEl: p.nameEl, nameEn: p.nameEn })
          .catch(() => null)
    }

    return { id: order.id }
  }

  /**
   * Replaces stored object keys on each line's product with loadable URLs.
   * Keys are collected across the whole result and resolved once per key, so a
   * product appearing in several orders is not presigned repeatedly.
   */
  private async withResolvedImages<T extends { items: { product: { images: string[] } | null }[] }>(
    orders: T[],
  ): Promise<T[]> {
    const keys = new Set<string>()
    for (const order of orders) {
      for (const item of order.items) {
        const first = item.product?.images?.[0]
        if (first) keys.add(first)
      }
    }
    if (keys.size === 0) return orders

    const list = [...keys]
    const resolved = await this.storage.resolve(list)
    const byKey = new Map(list.map((key, i) => [key, resolved[i]]))

    for (const order of orders) {
      for (const item of order.items) {
        const first = item.product?.images?.[0]
        if (item.product && first) {
          item.product.images = [byKey.get(first) ?? first]
        }
      }
    }
    return orders
  }

  async findByUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productPrice: true,
            quantity: true,
            unitPrice: true,
            // The order history renders the product's name and photo and offers
            // "buy again", none of which the snapshot columns can supply. The
            // relation was never selected, so the UI read undefined: names were
            // blank and reorder filtered every line out.
            //
            // Nullable by design -- product is SetNull on delete, and the
            // snapshot columns above remain the historical record.
            product: {
              select: {
                id: true,
                slug: true,
                nameEl: true,
                nameEn: true,
                price: true,
                stock: true,
                isActive: true,
                images: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return this.withResolvedImages(orders)
  }

  async findOneForUser(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productPrice: true,
            quantity: true,
            unitPrice: true,
            // The order history renders the product's name and photo and offers
            // "buy again", none of which the snapshot columns can supply. The
            // relation was never selected, so the UI read undefined: names were
            // blank and reorder filtered every line out.
            //
            // Nullable by design -- product is SetNull on delete, and the
            // snapshot columns above remain the historical record.
            product: {
              select: {
                id: true,
                slug: true,
                nameEl: true,
                nameEn: true,
                price: true,
                stock: true,
                isActive: true,
                images: true,
              },
            },
          },
        },
      },
    })
    if (!order) throw new NotFoundException('Order not found')
    const [resolved] = await this.withResolvedImages([order])
    return resolved
  }

  // ── Admin (moved unchanged from AdminService) ────────────────

  /**
   * Paginated order list. This previously returned every order ever placed in
   * one unbounded query, which the client then filtered in memory -- fine at
   * demo scale, progressively slower for a real shop and eventually a timeout.
   *
   * Search and the payment-status filter moved server-side with it, since
   * filtering one page in the browser would otherwise only ever search the page
   * you happen to be looking at.
   */
  async listForAdmin({ page = 1, search, paymentStatus }: {
    page?: number
    search?: string
    paymentStatus?: string
  } = {}) {
    const PAGE_SIZE = 25
    const skip = (Math.max(1, page) - 1) * PAGE_SIZE

    const where: Prisma.OrderWhereInput = {}

    const mappedPayment = PAYMENT_STATUS_MAP[paymentStatus ?? '']
    if (mappedPayment) where.paymentStatus = mappedPayment

    const term = search?.trim()
    if (term) {
      // Staff see an order as the first 8 characters of its uuid, so a prefix
      // has to match. Prisma types a uuid column as UuidFilter, which has no
      // startsWith, so the ids are resolved separately and fed back in as an
      // `in` list. The extra query only runs when the term looks like hex.
      let idMatches: string[] = []
      if (UUID_PREFIX.test(term)) {
        const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM orders WHERE id::text LIKE ${`${term.toLowerCase()}%`} LIMIT 100
        `
        idMatches = rows.map((r) => r.id)
      }

      where.OR = [
        ...(idMatches.length ? [{ id: { in: idMatches } }] : []),
        { guestEmail: { contains: term, mode: 'insensitive' as const } },
        { user: { email: { contains: term, mode: 'insensitive' as const } } },
        { user: { fullName: { contains: term, mode: 'insensitive' as const } } },
      ]
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.order.count({ where }),
    ])

    return { orders, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
  }

  async updateStatus(id: string, status: string) {
    const mapped = STATUS_MAP[status]
    if (!mapped) throw new NotFoundException(`Unknown status: ${status}`)
    return this.prisma.order.update({ where: { id }, data: { status: mapped } })
  }
}
