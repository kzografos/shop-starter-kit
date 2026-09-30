import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'
import { NotificationType, Prisma } from '@prisma/client'

type Client = Prisma.TransactionClient | PrismaService

const STAFF_UNREAD_COUNT_KEY = 'notifications:unread:count'
const userUnreadCountKey = (userId: string) => `notifications:unread:${userId}`
const UNREAD_COUNT_TTL = 30
const PAGE_SIZE = 20

export type OpenNotificationFilter = { productId?: string; type?: NotificationType }

export type CreateNotification = {
  type: NotificationType
  /** Addressee; absent = the staff inbox. */
  userId?: string
  /** Idempotency key: a second create with the same key is a no-op. */
  key?: string
  productId?: string
  stock?: number
  meta?: Prisma.InputJsonValue
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ── Persistence primitives (domain-free) ─────────────────────
  // Modules own the rules that decide WHEN a notification opens, refreshes or
  // resolves (e.g. products/stock-alerts.service.ts, order status changes);
  // this service only knows rows and the unread-count caches. A row without a
  // userId belongs to the staff inbox; with one, to that user's feed.
  // `productId`/`stock` are the columns the schema has today (blueprint §9).

  /** First open (unread) staff notification matching the filter, or null. */
  findOpen(where: OpenNotificationFilter) {
    return this.prisma.notification.findFirst({
      where: { ...where, userId: null, isRead: false },
      select: { id: true },
    })
  }

  /**
   * Opens a notification and invalidates the right unread counter. With a
   * `key`, a duplicate is a no-op that returns null: only the unique-index
   * violation on `key` (P2002) is swallowed, any other failure propagates.
   */
  async create(data: CreateNotification) {
    let row
    try {
      row = await this.prisma.notification.create({ data })
    } catch (err) {
      if (
        data.key &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        (err.meta?.target as string[] | undefined)?.includes('key')
      ) {
        return null
      }
      throw err
    }
    await this.invalidateUnread(data.userId)
    return row
  }

  /**
   * The insert behind `create()` as a single write for a caller's own
   * transaction (batch or interactive). Idempotent on `key` without raising:
   * a duplicate is `ON CONFLICT DO NOTHING`, so it neither fails a batch nor
   * aborts an interactive transaction the way a caught P2002 would. The
   * caller invalidates the unread counter with `invalidateUnread()` once its
   * transaction has committed.
   */
  createWrite(client: Client, data: CreateNotification): Prisma.PrismaPromise<{ count: number }> {
    return client.notification.createMany({ data, skipDuplicates: true })
  }

  /** Updates an existing notification's payload; does not touch read state. */
  update(id: string, data: { stock?: number; meta?: Prisma.InputJsonValue }) {
    return this.prisma.notification.update({ where: { id }, data })
  }

  /** Marks every open staff notification matching the filter as read. Returns the count. */
  async resolveOpen(where: OpenNotificationFilter): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: { ...where, userId: null, isRead: false },
      data: { isRead: true },
    })
    if (res.count) await this.invalidateUnread(undefined)
    return res.count
  }

  /** Drops the cached unread counter of one user, or of the staff inbox when no user is given. */
  async invalidateUnread(userId: string | undefined) {
    await this.redis.del(userId ? userUnreadCountKey(userId) : STAFF_UNREAD_COUNT_KEY)
  }

  // ── Staff inbox (userId null) ───────────────────────────────

  async list({ page = 1, unreadOnly = false }: { page?: number; unreadOnly?: boolean }) {
    return this.page({ userId: null }, page, unreadOnly)
  }

  async unreadCount() {
    return this.countUnread(STAFF_UNREAD_COUNT_KEY, { userId: null })
  }

  async markRead(id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId: null }, data: { isRead: true } })
    await this.invalidateUnread(undefined)
    return { ok: true }
  }

  async markAllRead() {
    await this.prisma.notification.updateMany({ where: { userId: null, isRead: false }, data: { isRead: true } })
    await this.invalidateUnread(undefined)
    return { ok: true }
  }

  // ── Customer feed (userId set) ──────────────────────────────
  // Every query carries the owner, so a foreign notification is
  // indistinguishable from a missing one.

  async listForUser(userId: string, { page = 1, unreadOnly = false }: { page?: number; unreadOnly?: boolean } = {}) {
    return this.page({ userId }, page, unreadOnly)
  }

  async unreadCountForUser(userId: string) {
    return this.countUnread(userUnreadCountKey(userId), { userId })
  }

  async markReadForUser(id: string, userId: string) {
    const res = await this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } })
    if (res.count === 0) throw new NotFoundException('Notification not found')
    await this.invalidateUnread(userId)
    return { ok: true }
  }

  async markAllReadForUser(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } })
    await this.invalidateUnread(userId)
    return { ok: true }
  }

  // ── Shared ──────────────────────────────────────────────────

  private async page(scope: { userId: string | null }, requested: number, unreadOnly: boolean) {
    // Anything that is not a finite page number ≥ 1 (NaN, Infinity, 0, -3, 2.5) is page 1.
    const page = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1
    const where = unreadOnly ? { ...scope, isRead: false } : scope
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...scope, isRead: false } }),
    ])
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), unread }
  }

  private async countUnread(cacheKey: string, scope: { userId: string | null }) {
    const cached = await this.redis.get(cacheKey)
    if (cached !== null) return { count: Number(cached) }
    const count = await this.prisma.notification.count({ where: { ...scope, isRead: false } })
    await this.redis.set(cacheKey, String(count), UNREAD_COUNT_TTL)
    return { count }
  }
}
