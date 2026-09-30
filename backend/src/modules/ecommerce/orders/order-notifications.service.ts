import { Injectable } from '@nestjs/common'
import { OrderStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../../infrastructure/prisma/prisma.service'
import { NotificationsService } from '../../../core/notifications/notifications.service'

type Client = Prisma.TransactionClient | PrismaService

/** An order as the producer needs it: who to tell, about which order. */
export type NotifiableOrder = { id: string; userId: string | null }

/**
 * Every status an order can move INTO tells its customer. PENDING is where an
 * order starts, not somewhere it moves to, and the customer just placed it
 * themselves — the confirmation page and email cover that moment.
 */
export const NOTIFIED_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.READY,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
]

/** One notification per order per status, whoever moved it and however often. */
export const orderStatusNotificationKey = (orderId: string, status: OrderStatus) =>
  `order:${orderId}:status:${status.toLowerCase()}`

/**
 * Tells a customer that their order changed status, through Core's
 * notification rows (blueprint seam 5: the rule lives with orders, Core only
 * persists). Same shape as loyalty: the insert joins the transaction that
 * moves the order, so a rolled-back transition leaves no notification and a
 * committed one cannot lose it; the idempotency key makes a repeated or
 * concurrent transition of the same order into the same status a no-op.
 * Guest orders (no userId) have nobody to notify and write nothing.
 */
@Injectable()
export class OrderNotificationsService {
  constructor(private notifications: NotificationsService) {}

  /**
   * The write to include in the transaction that sets `status`, or null when
   * there is nothing to notify (guest order, or a status that is not
   * announced). Call `invalidate()` after the transaction commits.
   */
  statusWrite(client: Client, order: NotifiableOrder, status: OrderStatus): Prisma.PrismaPromise<unknown> | null {
    if (!order.userId || !NOTIFIED_ORDER_STATUSES.includes(status)) return null
    return this.notifications.createWrite(client, {
      type: 'ORDER_STATUS',
      userId: order.userId,
      key: orderStatusNotificationKey(order.id, status),
      meta: { order_id: order.id, status: status.toLowerCase() },
    })
  }

  /** After commit: the customer's unread counter is stale if a row was written. */
  async invalidate(order: NotifiableOrder) {
    if (order.userId) await this.notifications.invalidateUnread(order.userId)
  }
}
