import type { Notification } from '~~/types'
import type { NotificationPresenter, NotificationPresenterContext, NotificationView } from '#core/utils/notification-presenters'

// Shop (catalog): how the staff inbox's stock alerts read. The rows are what
// backend/src/modules/ecommerce/products/stock-alerts.service.ts writes — the
// product in `product_id`, the level in `stock`, the product's names in `meta`.
interface StockMeta { name_el?: string; name_en?: string }

/** The product's name in the active locale, then either name, then `—`. */
function productName(n: Notification, locale: string | undefined) {
  const meta = (n.meta ?? {}) as StockMeta
  const name = locale === 'el' ? meta.name_el : meta.name_en
  return name || meta.name_en || meta.name_el || '—'
}

/** An alert about a known product opens it in the admin product editor. */
function productAction(n: Notification, { t, localePath }: NotificationPresenterContext): Pick<NotificationView, 'to' | 'actionLabel'> {
  if (!n.product_id) return { to: null }
  return { to: localePath(`/admin/products?edit=${n.product_id}`), actionLabel: t('admin.view_product') }
}

export const lowStockPresenter: NotificationPresenter = (n, ctx) => ({
  title: ctx.t('admin.low_stock_title'),
  body: ctx.t('admin.low_stock_msg', { name: productName(n, ctx.locale), stock: n.stock ?? 0 }),
  tone: 'warning',
  ...productAction(n, ctx),
})

export const outOfStockPresenter: NotificationPresenter = (n, ctx) => ({
  title: ctx.t('admin.out_of_stock_title'),
  body: ctx.t('admin.out_of_stock_msg', { name: productName(n, ctx.locale) }),
  tone: 'danger',
  ...productAction(n, ctx),
})
