import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CoreEventBus } from '../core/events/core-event-bus.service'
import type { UserAuthenticatedEvent } from '../core/events/core-event.types'
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

  async link(userId: string, email: string) {
    const orders = await this.prisma.order.findMany({
      where: { guestEmail: email, userId: null },
      select: { id: true, total: true, paymentStatus: true },
    })
    if (orders.length === 0) return

    await this.prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { guestEmail: email, userId: null },
        data: { userId },
      })
      await this.awardForLinkedOrders(tx, userId, orders)
    })

    this.logger.log(`Linked ${orders.length} guest order(s) to user ${userId}`)
  }

  /**
   * Awards points for the already-paid orders among those just attached to the
   * user, at the same earn rate order creation uses. Runs inside the caller's
   * transaction so the order link and the points are committed together.
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
