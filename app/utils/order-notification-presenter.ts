import type { NotificationPresenter } from './notification-presenters'

// Shop (orders): how an `order_status` row reads. The `meta` shape
// (`order_id`, `status`) is what backend/src/orders/order-notifications.service.ts
// writes; the wording keys live under `notifications.order_*`.
const ORDER_STATUSES = ['confirmed', 'processing', 'ready', 'completed', 'cancelled'] as const

/**
 * An `order_status` row points at the order it is about. A status the UI does
 * not know how to phrase (a new transition) gets the generic order line, so
 * it still names the order instead of rendering blank.
 */
export const orderStatusPresenter: NotificationPresenter = (n, { t, localePath }) => {
  const orderId = typeof n.meta?.order_id === 'string' ? n.meta.order_id : null
  const status = typeof n.meta?.status === 'string' ? n.meta.status.toLowerCase() : ''
  const known = (ORDER_STATUSES as readonly string[]).includes(status)
  const ref = orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : ''
  return {
    title: known ? t(`notifications.order_${status}_title`) : t('notifications.order_status_title'),
    body: known ? t(`notifications.order_${status}_body`, { order: ref }) : t('notifications.order_status_body', { order: ref }),
    to: orderId ? localePath(`/account/orders/${orderId}`) : null,
  }
}
