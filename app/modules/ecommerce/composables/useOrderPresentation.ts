import type { Order, OrderItem, OrderStatus } from '#shop/types'

/**
 * Shared presentation of a customer order (list and detail pages): status
 * colours, the lifecycle track derived from the backend's transition table,
 * locale-aware item names and "repeat order". Keeps the two pages from
 * duplicating the same rules.
 */
type BadgeColor = 'error' | 'warning' | 'primary' | 'success' | 'neutral' | 'secondary' | 'info'

/** Forward path of the order lifecycle (backend/src/orders/order-status.ts); CANCELLED is a terminal branch. */
export const ORDER_LIFECYCLE: readonly OrderStatus[] = ['pending', 'confirmed', 'processing', 'ready', 'completed']

export type LifecycleStep = { status: OrderStatus; state: 'done' | 'current' | 'upcoming' | 'skipped' }

export function useOrderPresentation() {
  const { locale } = useI18n()
  const cartStore = useCartStore()
  const localePath = useLocalePath()
  const router = useRouter()

  function statusColor(status: string): BadgeColor {
    const map: Record<string, BadgeColor> = {
      pending: 'warning',
      confirmed: 'primary',
      processing: 'primary',
      ready: 'success',
      completed: 'success',
      cancelled: 'error',
    }
    return map[status] ?? 'neutral'
  }

  /**
   * The five forward steps with their state for this order. No timestamps
   * exist per step, so this is position only. A cancelled order keeps every
   * step "skipped": the API does not record where it left the track.
   */
  function lifecycleSteps(status: OrderStatus): LifecycleStep[] {
    if (status === 'cancelled') return ORDER_LIFECYCLE.map((s) => ({ status: s, state: 'skipped' }))
    const at = ORDER_LIFECYCLE.indexOf(status)
    return ORDER_LIFECYCLE.map((s, i) => ({ status: s, state: i < at ? 'done' : i === at ? 'current' : 'upcoming' }))
  }

  // Prefer the live product name so it follows the current locale; fall back to
  // the snapshot captured at order time, which is all that survives once a product
  // is deleted (the relation is SetNull).
  function itemName(item: OrderItem): string {
    if (item.product) {
      return locale.value === 'el' ? item.product.name_el : item.product.name_en
    }
    return item.product_name
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(locale.value === 'el' ? 'el-GR' : 'en-GB')
  }

  async function repeatOrder(order: Order) {
    if (!order.items) return
    // Deleted, deactivated and out-of-stock lines are skipped — they cannot be
    // bought again.
    const products = order.items
      .filter((i) => i.product && i.product.is_active && i.product.stock > 0)
      .map((i) => ({ product: i.product!, quantity: i.quantity }))
    cartStore.loadFromOrder(products)
    await router.push(localePath('/checkout'))
  }

  return { statusColor, lifecycleSteps, itemName, formatDate, repeatOrder }
}
