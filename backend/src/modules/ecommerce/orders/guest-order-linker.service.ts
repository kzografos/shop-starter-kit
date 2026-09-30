import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infrastructure/prisma/prisma.service'
import { CoreEventBus } from '../../../core/events/core-event-bus.service'
import type { UserAuthenticatedEvent } from '../../../core/events/core-event.types'
import { LoyaltyService } from '../loyalty/loyalty.service'
import { PricingSettingsService } from './pricing-settings.service'

type LinkedOrder = { id: string; total: Prisma.Decimal | number; paymentStatus: string }

/**
 * Attaches guest orders placed with an email address to the account that has
 * just authenticated with that address, and awards loyalty for the ones that
 * are already paid.
 *
 * Subscribes to Core's `user.authenticated` event. This used to be a private
 * method of AuthService, which made Core depend on orders, loyalty and pricing
 * settings; the behaviour is unchanged, only the owner moved.
 *
 * Concurrency: two authentications for the same address can run at once (two
 * tabs, a double-submitted form). Each order is claimed with a conditional
 * `UPDATE … WHERE user_id IS NULL`; the second transaction blocks on the row
 * lock, re-evaluates the condition after the first commits, matches nothing,
 * and therefore awards nothing. Points are earned only for rows *this*
 * transaction claimed, so an order can never be awarded twice.
 */
@Injectable()
export class GuestOrderLinkerService implements OnModuleInit {
  private readonly logger = new Logger(GuestOrderLinkerService.name)

  constructor(
    private prisma: PrismaService,
    private loyalty: LoyaltyService,
    private pricing: PricingSettingsService,
    private events: CoreEventBus,
  ) {}

  onModuleInit() {
    this.events.on('user.authenticated', GuestOrderLinkerService.name, (e) => this.onUserAuthenticated(e))
  }

  async onUserAuthenticated({ userId, email }: UserAuthenticatedEvent) {
    await this.link(userId, email)
  }

  /** Returns the orders this call linked (empty when there was nothing to claim). */
  async link(userId: string, email: string): Promise<LinkedOrder[]> {
    const linked = await this.prisma.$transaction(async (tx) => {
      // Candidates are read inside the transaction; the claim below is what decides.
      // Deterministic order so two concurrent claimers lock rows in the same sequence.
      const candidates = await tx.order.findMany({
        where: { guestEmail: email, userId: null },
        select: { id: true, total: true, paymentStatus: true },
        orderBy: { createdAt: 'asc' },
      })
      if (candidates.length === 0) return []

      const claimed: LinkedOrder[] = []
      for (const order of candidates) {
        const res = await tx.order.updateMany({ where: { id: order.id, userId: null }, data: { userId } })
        if (res.count === 0) continue // claimed by a concurrent authentication — theirs to award
        claimed.push(order)
      }
      if (claimed.length) await this.awardForLinkedOrders(tx, userId, claimed)
      return claimed
    })

    if (linked.length) this.logger.log(`Linked ${linked.length} guest order(s) to user ${userId}`)
    return linked
  }

  /**
   * Awards points for the already-paid orders among those this transaction
   * just attached to the user, at the same earn rate order creation uses.
   * Runs inside the caller's transaction so the order link and the points are
   * committed together — and rolled back together.
   */
  private async awardForLinkedOrders(
    tx: Prisma.TransactionClient,
    userId: string,
    orders: LinkedOrder[],
  ): Promise<number> {
    const { loyalty_earn_rate: earnRate } = await this.pricing.loadPricing()

    let points = 0
    for (const o of orders) {
      if (o.paymentStatus !== 'PAID') continue
      const earned = Math.floor(Number(o.total) * earnRate)
      if (earned <= 0) continue
      points += earned
      await this.loyalty.earn(tx, userId, o.id, earned)
    }
    return points
  }
}
