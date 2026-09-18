import type { Notification, NotificationList } from '~~/types'
import { describeNotification, type NotificationView } from '~/utils/notification-presenters'

export type { NotificationView }

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
  // Bumped by reset(): a response started under an earlier session (user A
  // signs out while a request is in flight, user B signs in) is discarded
  // instead of landing in B's state.
  const epoch = useState<number>('customer-notif-epoch', () => 0)

  function reset() {
    epoch.value++
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
    const started = epoch.value
    countInFlight = api<{ count: number }>('/notifications/unread-count')
      .then(({ count }) => { if (epoch.value === started) unread.value = count })
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
    const started = epoch.value
    listInFlight = api<NotificationList>('/notifications')
      .then((page) => {
        if (epoch.value !== started) return
        items.value = page.items
        unread.value = page.unread
        loaded.value = true
      })
      .catch(() => { if (epoch.value === started) error.value = true })
      .finally(() => {
        if (epoch.value === started) loading.value = false
        listInFlight = null
      })
    return listInFlight
  }

  /**
   * One page of the feed for the history page, straight from the API. Does
   * not touch the shared list (that is the bell's page 1); the unread figure
   * it carries is shared, since it is the same counter.
   */
  async function fetchPage(page: number): Promise<NotificationList> {
    const result = await api<NotificationList>('/notifications', { query: { page } })
    if (import.meta.client) unread.value = result.unread
    return result
  }

  /** Marks one row read. The row may belong to a page the bell has not loaded. */
  async function markRead(id: string) {
    const row = items.value.find((n) => n.id === id)
    if (row?.is_read) return
    await api(`/notifications/${id}/read`, { method: 'PATCH' })
    if (row) row.is_read = true
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
   * Title, body and destination for one row. Core knows no row type: the
   * module that produces a type registers its presenter
   * (`registerNotificationPresenter`, e.g. plugins/order-notifications.ts);
   * anything unregistered falls back to the generic line so a new type never
   * renders blank.
   */
  function describe(n: Notification): NotificationView {
    return describeNotification(n, { t, localePath })
  }

  return { items, unread, loaded, loading, error, load, fetchPage, refreshCount, markRead, markAllRead, describe, reset }
}
