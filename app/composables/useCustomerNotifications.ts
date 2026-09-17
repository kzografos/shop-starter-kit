import type { Notification, NotificationList } from '~~/types'

/** What the panel renders for one row: text plus, when it exists, where it leads. */
export interface NotificationView {
  title: string
  body: string
  to: string | null
}

const ORDER_STATUSES = ['confirmed', 'processing', 'ready', 'completed', 'cancelled'] as const

// Single-flight guards. Client-only state on purpose: the feed is never
// fetched during SSR (see `load()`), so a promise per browser tab is enough.
let listInFlight: Promise<void> | null = null
let countInFlight: Promise<void> | null = null

/**
 * The signed-in user's own notification feed (Core mechanism). State is
 * shared through `useState`, so the header bell and any other reader see one
 * list and one unread counter; mutations refresh both.
 *
 * Nothing here is fetched for anonymous visitors: every request goes through
 * `useApi()` (credentials included, 401 → refresh → retry) and is gated on
 * `isLoggedIn`, and the state is cleared on sign-out.
 */
export function useCustomerNotifications() {
  const api = useApi()
  const { t } = useI18n()
  const localePath = useLocalePath()
  const { isLoggedIn } = storeToRefs(useAuthStore())

  const items = useState<Notification[]>('customer-notif-items', () => [])
  const unread = useState<number>('customer-notif-unread', () => 0)
  const loaded = useState<boolean>('customer-notif-loaded', () => false)
  const loading = useState<boolean>('customer-notif-loading', () => false)
  const error = useState<boolean>('customer-notif-error', () => false)

  function reset() {
    items.value = []
    unread.value = 0
    loaded.value = false
    loading.value = false
    error.value = false
  }

  /** Unread counter only — cheap, cached server-side; what the bell needs. */
  function refreshCount(): Promise<void> {
    if (!import.meta.client || !isLoggedIn.value) return Promise.resolve()
    if (countInFlight) return countInFlight
    countInFlight = api<{ count: number }>('/notifications/unread-count')
      .then(({ count }) => { unread.value = count })
      .catch(() => { /* a missing badge must never break the header */ })
      .finally(() => { countInFlight = null })
    return countInFlight
  }

  /** First page of the feed (newest first) and the unread figure it carries. */
  function load(): Promise<void> {
    if (!import.meta.client || !isLoggedIn.value) return Promise.resolve()
    if (listInFlight) return listInFlight
    loading.value = true
    error.value = false
    listInFlight = api<NotificationList>('/notifications')
      .then((page) => {
        items.value = page.items
        unread.value = page.unread
        loaded.value = true
      })
      .catch(() => { error.value = true })
      .finally(() => {
        loading.value = false
        listInFlight = null
      })
    return listInFlight
  }

  async function markRead(id: string) {
    const row = items.value.find((n) => n.id === id)
    if (!row || row.is_read) return
    await api(`/notifications/${id}/read`, { method: 'PATCH' })
    row.is_read = true
    unread.value = Math.max(0, unread.value - 1)
    await refreshCount()
  }

  async function markAllRead() {
    if (unread.value === 0) return
    await api('/notifications/read-all', { method: 'PATCH' })
    for (const n of items.value) n.is_read = true
    unread.value = 0
    await refreshCount()
  }

  /**
   * Title, body and destination for one row, from its type and meta. An
   * `order_status` row points at the order it is about; anything the UI does
   * not know how to phrase falls back to a generic line so a new type never
   * renders blank.
   */
  function describe(n: Notification): NotificationView {
    if (n.type === 'order_status') {
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
    return { title: t('notifications.generic_title'), body: '', to: null }
  }

  return { items, unread, loaded, loading, error, load, refreshCount, markRead, markAllRead, describe, reset }
}
