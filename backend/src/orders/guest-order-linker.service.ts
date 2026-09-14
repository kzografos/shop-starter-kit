import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CoreEventBus } from '../core/events/core-event-bus.service'
import type { UserAuthenticatedEvent } from '../core/events/core-event.types'
import { LoyaltyService } from './loyalty.service'

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
      await this.loyalty.awardForLinkedOrders(tx, userId, orders)
    })

    this.logger.log(`Linked ${orders.length} guest order(s) to user ${userId}`)
  }
}
