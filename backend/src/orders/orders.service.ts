import { Injectable, BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { orderConfirmationMail } from './order-confirmation.mail'
import { ProductsService } from '../products/products.service'
import { StockAlertsService } from '../products/stock-alerts.service'
import { PricingSettingsService } from './pricing-settings.service'
import { LoyaltyService } from '../loyalty/loyalty.service'
import { AnalyticsService } from '../analytics/analytics.service'
import { StorageAdapter } from '../storage/storage-adapter'
import { OrderNotificationsService } from './order-notifications.service'
import { afterCommit } from '../common/utils/after-commit'
import { CreateOrderDto } from './dto/create-order.dto'
import { allowedTransitions, canTransition } from './order-status'
import { Decimal } from '@prisma/client/runtime/library'
import { Order, OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { createHash } from 'crypto'

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

/**
 * Deterministic JSON with sorted keys, so two requests carrying the same
 * order (whatever the property order on the wire) hash identically.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

// Bookkeeping columns of the idempotency mechanism: read only by
// findIdempotentReplay(), never part of an order payload.
const ORDER_PRIVATE = { idempotencyKey: true, idempotencyHash: true } as const

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
  private readonly logger = new Logger(OrdersService.name)

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private products: ProductsService,
    private stockAlerts: StockAlertsService,
    private pricing: PricingSettingsService,
    private loyalty: LoyaltyService,
    private analytics: AnalyticsService,
    private storage: StorageAdapter,
    private orderNotifications: OrderNotificationsService,
  ) {}

  /**
   * Places an order. With an `idempotencyKey` (the `Idempotency-Key` request
   * header) a repeat of the same request returns the order the first one
   * created instead of placing a second: the key is scoped to the buyer
   * (user id, or the guest email) and stored on the order row inside the
   * creation transaction, so it is taken only by a committed order — a
   * failed attempt (out of stock, bad points) leaves the key free for the
   * retry. The same key with a different payload is refused with 409.
   */
  async create(userId: string | null, userEmail: string | null, dto: CreateOrderDto, idempotencyKey?: string) {
    // Guest checkout: must supply an email for the order confirmation.
    const guestEmail = userId ? null : dto.guestEmail
    if (!userId && !guestEmail)
      throw new BadRequestException('Email is required to place an order as a guest')
    const confirmationEmail = userEmail ?? guestEmail!
    // Capture as const so TS narrows it inside the transaction closure below.
    const uid = userId

    const scopedKey = idempotencyKey
      ? `${uid ? `user:${uid}` : `guest:${guestEmail!.trim().toLowerCase()}`}:${idempotencyKey}`
      : null
    const payloadHash = scopedKey
      ? createHash('sha256').update(stableStringify({ ...dto, guestEmail: guestEmail?.trim().toLowerCase() })).digest('hex')
      : null
    if (scopedKey) {
      const replay = await this.findIdempotentReplay(scopedKey, payloadHash!)
      if (replay) return replay
    }

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
    let order: Order
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            userId,
            guestEmail,
            idempotencyKey: scopedKey,
            idempotencyHash: payloadHash,
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
          await this.orderNotifications.statusWrite(tx, newOrder, OrderStatus.CONFIRMED)
        }

        return newOrder
      })
    } catch (err) {
      // Two requests with the same key raced: the other one committed first
      // and this transaction rolled back (no stock, points or rows written).
      // Answer with the order that won, exactly as a later retry would.
      if (
        scopedKey &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        (err.meta?.target as string[] | undefined)?.includes('idempotency_key')
      ) {
        const replay = await this.findIdempotentReplay(scopedKey, payloadHash!)
        if (replay) return replay
      }
      throw err
    }
    if (dto.paymentMethod !== 'STRIPE') await this.orderNotifications.invalidate(order)

    // Only cash/card-on-pickup orders are settled here. A Stripe order is still
    // unpaid at this point, so its confirmation is sent from the webhook once
    // payment actually clears -- otherwise abandoning checkout still produced a
    // "your order has been confirmed" email.
    // Everything below is detached post-commit work: the order is placed
    // whatever happens here, and a failure is logged, never raised.
    if (dto.paymentMethod !== 'STRIPE') {
      afterCommit(this.logger, `Order ${order.id} confirmation email`, () =>
        this.mail.sendMail(orderConfirmationMail(this.mail, confirmationEmail, order.id), 'Order confirmation email'),
      )
    }
    // A new order changes every report; through the owner.
    afterCommit(this.logger, `Order ${order.id} analytics invalidation`, () => this.analytics.invalidate())

    // Low-stock alerts for the products we just decremented.
    for (const item of dto.items) {
      const p = products.find((x) => x.id === item.productId)
      if (p)
        afterCommit(this.logger, `Order ${order.id} stock alert for product ${p.id}`, () =>
          this.stockAlerts.checkStock({ id: p.id, stock: p.stock - item.quantity, nameEl: p.nameEl, nameEn: p.nameEn }),
        )
    }

    return { id: order.id }
  }

  /**
   * The order a key was already used for, as the creation response, or null
   * when the key is free. A key reused with a different payload is a client
   * error: the caller wanted a *different* order under a key that already
   * names one.
   */
  private async findIdempotentReplay(scopedKey: string, payloadHash: string): Promise<{ id: string } | null> {
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey: scopedKey },
      select: { id: true, idempotencyHash: true },
    })
    if (!existing) return null
    if (existing.idempotencyHash !== payloadHash) {
      throw new ConflictException('Idempotency key was already used for a different order')
    }
    this.logger.log(`Order ${existing.id} returned for a repeated idempotency key`)
    return { id: existing.id }
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
      omit: ORDER_PRIVATE,
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
    return (await this.withResolvedImages(orders)).map((o) => this.withCanCancel(o))
  }

  async findOneForUser(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      omit: ORDER_PRIVATE,
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
    return this.withCanCancel(resolved)
  }

  /**
   * What a customer may cancel themselves: a pending order that has not been
   * paid. Everything else goes through the store. Only customer-facing
   * payloads carry the flag; admin payloads are untouched.
   */
  private customerCanCancel(order: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean {
    return order.status === OrderStatus.PENDING && order.paymentStatus !== PaymentStatus.PAID
  }

  private withCanCancel<T extends { status: OrderStatus; paymentStatus: PaymentStatus }>(order: T) {
    return { ...order, canCancel: this.customerCanCancel(order) }
  }

  /**
   * Customer self-cancellation. Ownership is part of the lookup, so a foreign
   * order is indistinguishable from a missing one (404). A paid order, or one
   * the store has already moved on, is refused with a clear 400; the actual
   * cancellation — restock, loyalty reversal, idempotency — is the same
   * cancel() the admin path uses.
   */
  async cancelForCustomer(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { status: true, paymentStatus: true },
    })
    if (!order) throw new NotFoundException('Order not found')
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('A paid order cannot be cancelled online — please contact the store')
    }
    if (order.status !== OrderStatus.PENDING) {
      if (!canTransition(order.status, OrderStatus.CANCELLED)) {
        throw new BadRequestException(`Cannot change status from ${order.status.toLowerCase()} to cancelled`)
      }
      throw new BadRequestException('Only a pending order can be cancelled online — please contact the store')
    }
    await this.cancel(orderId, 'customer')
    return this.findOneForUser(orderId, userId)
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
        omit: ORDER_PRIVATE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.order.count({ where }),
    ])

    // Each row carries the statuses it may move to next, so the admin UI
    // offers exactly what updateStatus() will accept.
    return {
      orders: orders.map((o) => ({
        ...o,
        allowedStatuses: allowedTransitions(o.status).map((s) => s.toLowerCase()),
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    }
  }

  /**
   * Moves an order along the lifecycle in ./order-status.ts. Anything that is
   * not a listed forward transition — going back, repeating the current
   * status, leaving COMPLETED or CANCELLED — is rejected with 400. The write
   * is conditional on the status that was checked, so two staff members
   * moving the same order at once cannot both win: the second sees 409 and
   * re-reads, exactly like cancel().
   */
  async updateStatus(id: string, status: string) {
    const mapped = STATUS_MAP[status]
    if (!mapped) throw new NotFoundException(`Unknown status: ${status}`)
    // Cancelling has side effects (restock, loyalty); one implementation owns it.
    if (mapped === OrderStatus.CANCELLED) return this.cancel(id)
    const current = await this.prisma.order.findUnique({ where: { id }, select: { status: true, userId: true } })
    if (!current) throw new NotFoundException('Order not found')
    if (!canTransition(current.status, mapped)) {
      throw new BadRequestException(
        `Cannot change status from ${current.status.toLowerCase()} to ${status}`,
      )
    }
    // The customer's notification commits with the status, or not at all.
    const order = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({ where: { id, status: current.status }, data: { status: mapped } })
      if (moved.count === 0) throw new ConflictException('Order changed while its status was being updated')
      await this.orderNotifications.statusWrite(tx, { id, userId: current.userId }, mapped)
      return tx.order.findUniqueOrThrow({ where: { id }, omit: ORDER_PRIVATE })
    })
    await this.orderNotifications.invalidate({ id, userId: current.userId })
    return order
  }

  /**
   * Cancels an order and undoes what placing it did: every line's quantity
   * goes back into stock and, for a customer order, the loyalty ledger is
   * reversed. Runs in one transaction keyed on the status transition, so a
   * repeated or concurrent cancellation cannot restock or reverse twice — the
   * second attempt sees CANCELLED and is rejected like any other illegal
   * transition. Payment is not touched: a refund, where one is due, is a
   * separate decision.
   */
  async cancel(id: string, reason?: string) {
    const { order, restocked } = await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        select: { status: true, userId: true, items: { select: { productId: true, quantity: true } } },
      })
      if (!current) throw new NotFoundException('Order not found')
      if (!canTransition(current.status, OrderStatus.CANCELLED)) {
        throw new BadRequestException(
          `Cannot change status from ${current.status.toLowerCase()} to cancelled`,
        )
      }

      // Conditional on the status we just read: if another cancellation (or
      // any other transition) got in first, nothing below runs.
      const moved = await tx.order.updateMany({
        where: { id, status: current.status },
        data: { status: OrderStatus.CANCELLED },
      })
      if (moved.count === 0) throw new ConflictException('Order changed while it was being cancelled')

      await this.orderNotifications.statusWrite(tx, { id, userId: current.userId }, OrderStatus.CANCELLED)

      const restocked: string[] = []
      for (const item of current.items) {
        if (!item.productId) continue // product deleted since; nothing to restock
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
        restocked.push(item.productId)
      }

      if (current.userId) await this.loyalty.reverseForOrder(tx, current.userId, id)

      return { order: await tx.order.findUniqueOrThrow({ where: { id }, omit: ORDER_PRIVATE }), restocked }
    })

    this.logger.log(`Order ${id} cancelled${reason ? ` (${reason})` : ''}: ${restocked.length} line(s) restocked`)

    await this.orderNotifications.invalidate(order)

    // Stock and reports changed; same owners, same detached post-commit work
    // as order creation. The cancellation is committed: nothing below may
    // fail this request, so even the re-read of the restocked rows is detached.
    await this.products.invalidate()
    afterCommit(this.logger, `Order ${id} analytics invalidation`, () => this.analytics.invalidate())
    if (restocked.length) {
      afterCommit(this.logger, `Order ${id} stock alerts after restock`, async () => {
        const products = await this.prisma.product.findMany({
          where: { id: { in: restocked } },
          select: { id: true, stock: true, nameEl: true, nameEn: true },
        })
        for (const p of products)
          afterCommit(this.logger, `Order ${id} stock alert for product ${p.id}`, () => this.stockAlerts.checkStock(p))
      })
    }

    return order
  }
}
