import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { NotificationType } from '@prisma/client'

const LOW_STOCK_THRESHOLD = 10
const UNREAD_COUNT_KEY = 'notifications:unread:count'
const UNREAD_COUNT_TTL = 30
const PAGE_SIZE = 20

type StockProduct = { id: string; stock: number; nameEl: string; nameEn: string }

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Called whenever a product's stock changes. Opens a low/out-of-stock alert
   * (de-duplicated per product+type) or clears open alerts once restocked.
   */
  async checkStock(product: StockProduct) {
    const { id, stock, nameEl, nameEn } = product

    // Restocked above the threshold — resolve any open alerts.
    if (stock >= LOW_STOCK_THRESHOLD) {
      const res = await this.prisma.notification.updateMany({
        where: { productId: id, isRead: false },
        data: { isRead: true },
      })
      if (res.count) await this.redis.del(UNREAD_COUNT_KEY)
      return
    }

    const type = stock <= 0 ? NotificationType.OUT_OF_STOCK : NotificationType.LOW_STOCK

    // Already an open alert of this type — just refresh the stock figure.
    const existing = await this.prisma.notification.findFirst({
      where: { productId: id, type, isRead: false },
      select: { id: true },
    })
    if (existing) {
      await this.prisma.notification.update({ where: { id: existing.id }, data: { stock } })
      return
    }

    // Escalating low -> out: close the stale low-stock alert.
    if (type === NotificationType.OUT_OF_STOCK) {
      await this.prisma.notification.updateMany({
        where: { productId: id, type: NotificationType.LOW_STOCK, isRead: false },
        data: { isRead: true },
      })
    }

    await this.prisma.notification.create({
      data: { type, productId: id, stock, meta: { name_el: nameEl, name_en: nameEn } },
    })
    await this.redis.del(UNREAD_COUNT_KEY)
  }

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
