import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { NotificationType, Prisma } from '@prisma/client'

const UNREAD_COUNT_KEY = 'notifications:unread:count'
const UNREAD_COUNT_TTL = 30
const PAGE_SIZE = 20

export type OpenNotificationFilter = { productId?: string; type?: NotificationType }

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ── Persistence primitives (domain-free) ─────────────────────
  // Modules own the rules that decide WHEN a notification opens, refreshes or
  // resolves (e.g. products/stock-alerts.service.ts); this service only knows
  // rows and the unread-count cache. `productId`/`stock` are the columns the
  // schema has today (blueprint §9); they generalise with the schema step.

  /** First open (unread) notification matching the filter, or null. */
  findOpen(where: OpenNotificationFilter) {
    return this.prisma.notification.findFirst({
      where: { ...where, isRead: false },
      select: { id: true },
    })
  }

  /** Opens a notification and invalidates the unread counter. */
  async create(data: { type: NotificationType; productId?: string; stock?: number; meta?: Prisma.InputJsonValue }) {
    const row = await this.prisma.notification.create({ data })
    await this.redis.del(UNREAD_COUNT_KEY)
    return row
  }

  /** Updates an existing notification's payload; does not touch read state. */
  update(id: string, data: { stock?: number; meta?: Prisma.InputJsonValue }) {
    return this.prisma.notification.update({ where: { id }, data })
  }

  /** Marks every open notification matching the filter as read. Returns the count. */
  async resolveOpen(where: OpenNotificationFilter): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: { ...where, isRead: false },
      data: { isRead: true },
    })
    if (res.count) await this.redis.del(UNREAD_COUNT_KEY)
    return res.count
  }

  // ── Inbox ───────────────────────────────────────────────────

  async list({ page = 1, unreadOnly = false }: { page?: number; unreadOnly?: boolean }) {
    const where = unreadOnly ? { isRead: false } : {}
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { isRead: false } }),
    ])
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), unread }
  }

  async unreadCount() {
    const cached = await this.redis.get(UNREAD_COUNT_KEY)
    if (cached !== null) return { count: Number(cached) }
    const count = await this.prisma.notification.count({ where: { isRead: false } })
    await this.redis.set(UNREAD_COUNT_KEY, String(count), UNREAD_COUNT_TTL)
    return { count }
  }

  async markRead(id: string) {
    await this.prisma.notification.updateMany({ where: { id }, data: { isRead: true } })
    await this.redis.del(UNREAD_COUNT_KEY)
    return { ok: true }
  }

  async markAllRead() {
    await this.prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } })
    await this.redis.del(UNREAD_COUNT_KEY)
    return { ok: true }
  }
}
