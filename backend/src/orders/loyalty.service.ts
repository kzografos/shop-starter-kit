import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PricingSettingsService } from './pricing-settings.service'

type LinkedOrder = { id: string; total: Prisma.Decimal | number; paymentStatus: string }

/**
 * Loyalty rules owned by the shop. Lives in the orders module until a
 * dedicated loyalty module exists (blueprint seam 2); the earn rate is read
 * the same way OrdersService.create() reads it, through PricingSettingsService.
 */
@Injectable()
export class LoyaltyService {
  constructor(private pricing: PricingSettingsService) {}

  /**
   * Awards points for already-paid orders that have just been attached to a
   * user (guest orders claimed on register / login). Runs inside the caller's
   * transaction so the order link and the points are committed together.
   */
  async awardForLinkedOrders(
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
      await tx.loyaltyTransaction.create({
        data: { userId, orderId: o.id, pointsDelta: earned, type: 'EARN' },
      })
    }
    if (points > 0) {
      await tx.user.update({ where: { id: userId }, data: { loyaltyPoints: { increment: points } } })
    }
    return points
  }
}
