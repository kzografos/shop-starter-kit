import { Injectable } from '@nestjs/common'
import { NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service'

const LOW_STOCK_THRESHOLD = 10

export type StockProduct = { id: string; stock: number; nameEl: string; nameEn: string }

/**
 * Stock-alert rules. Owned by the products domain; Core's NotificationsService
 * only persists rows and keeps the unread counter.
 *
 * Moved unchanged from NotificationsService.checkStock(): de-duplicated per
 * product+type, escalates low -> out of stock, auto-resolves on restock.
 */
@Injectable()
export class StockAlertsService {
  constructor(private notifications: NotificationsService) {}

  /**
   * Called whenever a product's stock changes. Opens a low/out-of-stock alert
   * (de-duplicated per product+type) or clears open alerts once restocked.
   */
  async checkStock(product: StockProduct) {
    const { id, stock, nameEl, nameEn } = product

    // Restocked above the threshold — resolve any open alerts.
    if (stock >= LOW_STOCK_THRESHOLD) {
      await this.notifications.resolveOpen({ productId: id })
      return
    }

    const type = stock <= 0 ? NotificationType.OUT_OF_STOCK : NotificationType.LOW_STOCK

    // Already an open alert of this type — just refresh the stock figure.
    const existing = await this.notifications.findOpen({ productId: id, type })
    if (existing) {
      await this.notifications.update(existing.id, { stock })
      return
    }

    // Escalating low -> out: close the stale low-stock alert.
    if (type === NotificationType.OUT_OF_STOCK) {
      await this.notifications.resolveOpen({ productId: id, type: NotificationType.LOW_STOCK })
    }

    await this.notifications.create({ type, productId: id, stock, meta: { name_el: nameEl, name_en: nameEn } })
  }
}
