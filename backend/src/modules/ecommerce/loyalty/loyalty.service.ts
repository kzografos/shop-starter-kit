import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

type Client = Prisma.TransactionClient | PrismaService

/**
 * Loyalty balance and ledger (e-commerce `loyalty` sub-domain, blueprint seam 2).
 *
 * The balance lives in `LoyaltyAccount.points`; a user without a row has 0.
 * Every balance change is written together with a `LoyaltyTransaction` row,
 * inside the caller's transaction, so ledger and balance cannot drift. This
 * is the only place that writes either table.
 *
 * Earn/redeem arithmetic (rates, minimums) stays with the callers — order
 * creation, the payment webhook, guest-order linking — exactly as before; this
 * service only owns where the points are stored.
 */
@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) {}

  async balance(userId: string): Promise<number> {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
      select: { points: true },
    })
    return account?.points ?? 0
  }

  /** Balances for many users at once; users without an account map to 0. */
  async balances(userIds: readonly string[]): Promise<Map<string, number>> {
    const accounts = await this.prisma.loyaltyAccount.findMany({
      where: { userId: { in: [...userIds] } },
      select: { userId: true, points: true },
    })
    const result = new Map(userIds.map((id) => [id, 0]))
    for (const a of accounts) result.set(a.userId, a.points)
    return result
  }

  /** Transaction history, newest first (the `GET /profile/loyalty` payload). */
  history(userId: string) {
    return this.prisma.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** Credits `points` for an order inside the caller's transaction. */
  async earn(tx: Client, userId: string, orderId: string, points: number): Promise<void> {
    for (const write of this.earnWrites(tx, userId, orderId, points)) await write
  }

  /**
   * The two writes behind `earn()`, for callers that compose a batch
   * `prisma.$transaction([...])` (the payment webhook keeps its ProcessedEvent
   * insert at the head of one array transaction).
   */
  earnWrites(client: Client, userId: string, orderId: string, points: number): Prisma.PrismaPromise<unknown>[] {
    return [
      client.loyaltyTransaction.create({
        data: { userId, orderId, pointsDelta: points, type: 'EARN' },
      }),
      client.loyaltyAccount.upsert({
        where: { userId },
        create: { userId, points },
        update: { points: { increment: points } },
      }),
    ]
  }

  /**
   * Undoes an order's loyalty effect inside the caller's transaction, using
   * only the existing ledger types: points the order earned are taken back
   * with a negative EARN row, points it redeemed are given back with a
   * positive REDEEM row. Works from the ledger's own net per type, so running
   * it again — or on an order that never earned or redeemed — writes nothing.
   */
  async reverseForOrder(
    tx: Client,
    userId: string,
    orderId: string,
  ): Promise<{ earnReversed: number; redeemRestored: number }> {
    const rows = await tx.loyaltyTransaction.findMany({
      where: { userId, orderId },
      select: { type: true, pointsDelta: true },
    })
    const net = (type: 'EARN' | 'REDEEM') =>
      rows.filter((r) => r.type === type).reduce((sum, r) => sum + r.pointsDelta, 0)

    const earnReversed = Math.max(net('EARN'), 0)
    if (earnReversed > 0) {
      await tx.loyaltyTransaction.create({
        data: { userId, orderId, pointsDelta: -earnReversed, type: 'EARN' },
      })
      await tx.loyaltyAccount.update({
        where: { userId },
        data: { points: { decrement: earnReversed } },
      })
    }

    const redeemRestored = Math.max(-net('REDEEM'), 0)
    if (redeemRestored > 0) {
      await tx.loyaltyTransaction.create({
        data: { userId, orderId, pointsDelta: redeemRestored, type: 'REDEEM' },
      })
      await tx.loyaltyAccount.upsert({
        where: { userId },
        create: { userId, points: redeemRestored },
        update: { points: { increment: redeemRestored } },
      })
    }

    return { earnReversed, redeemRestored }
  }

  /**
   * Debits `points` for an order inside the caller's transaction. The caller
   * has already checked the balance covers it, so the account row exists.
   */
  async redeem(tx: Client, userId: string, orderId: string, points: number): Promise<void> {
    await tx.loyaltyTransaction.create({
      data: { userId, orderId, pointsDelta: -points, type: 'REDEEM' },
    })
    await tx.loyaltyAccount.update({
      where: { userId },
      data: { points: { decrement: points } },
    })
  }
}
