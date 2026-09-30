<template>
  <div class="bg-surface-page min-h-screen">
    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 max-w-6xl mx-auto px-4 py-10">
      <AccountSidebar />

      <div class="flex flex-col gap-6">
        <NuxtLink
          :to="localePath('/account/orders')"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-[--color-bark-light] hover:text-[--color-bark] transition-colors w-fit"
        >
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
          {{ $t('orders.back_to_orders') }}
        </NuxtLink>

        <!-- Loading -->
        <div v-if="pending" class="space-y-4">
          <USkeleton class="h-10 w-1/2 rounded-xl" />
          <USkeleton class="h-24 rounded-xl" />
          <USkeleton class="h-40 rounded-xl" />
        </div>

        <!-- Not found: a foreign or unknown id answers 404 and shows nothing. -->
        <div v-else-if="notFound" class="text-center py-20">
          <UIcon name="i-heroicons-magnifying-glass" class="w-16 h-16 text-[--color-bark-light] mx-auto mb-4" />
          <h1 class="font-display text-2xl font-bold text-[--color-bark]">{{ $t('orders.not_found_title') }}</h1>
          <p class="text-sm text-[--color-bark-light] mt-2">{{ $t('orders.not_found_text') }}</p>
          <UButton :label="$t('orders.back_to_orders')" :to="localePath('/account/orders')" class="mt-6" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="text-center py-12 text-danger">
          {{ $t('orders.load_failed') }}
        </div>

        <template v-else-if="order">
          <!-- Header -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 class="font-display text-3xl font-bold text-[--color-bark]">
                {{ $t('orders.order_number') }}{{ order.id.slice(0, 8).toUpperCase() }}
              </h1>
              <p class="text-sm text-[--color-bark-light] mt-1">{{ formatDate(order.created_at) }}</p>
            </div>
            <UBadge
              :label="$t(`orders.status_${order.status}`)"
              :color="statusColor(order.status)"
              variant="subtle"
              size="lg"
            />
          </div>

          <!-- Lifecycle progress: position on the forward track, no timestamps -->
          <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5">
            <p class="text-xs font-semibold uppercase tracking-widest text-[--color-bark-light] mb-4">
              {{ $t('orders.progress') }}
            </p>
            <ol class="flex items-start" :class="order.status === 'cancelled' ? 'opacity-50' : ''">
              <li
                v-for="(step, i) in steps"
                :key="step.status"
                class="flex-1 flex flex-col items-center text-center relative"
                :data-state="step.state"
              >
                <div
                  v-if="i > 0"
                  class="absolute top-3 right-1/2 w-full h-0.5"
                  :class="step.state === 'done' || step.state === 'current' ? 'bg-terracotta' : 'bg-[--color-border-warm]'"
                />
                <span
                  class="relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2"
                  :class="stepClass(step.state)"
                >
                  <UIcon v-if="step.state === 'done'" name="i-heroicons-check" class="w-3.5 h-3.5" />
                  <span v-else>{{ i + 1 }}</span>
                </span>
                <span
                  class="mt-2 text-[11px] sm:text-xs leading-tight"
                  :class="step.state === 'current' ? 'font-semibold text-[--color-bark]' : 'text-[--color-bark-light]'"
                >
                  {{ $t(`orders.status_${step.status}`) }}
                </span>
              </li>
            </ol>
            <!-- Cancelled is a terminal branch off the track -->
            <div
              v-if="order.status === 'cancelled'"
              class="mt-4 flex items-center gap-2 text-sm font-medium text-warm-red"
              data-state="cancelled"
            >
              <UIcon name="i-heroicons-x-circle" class="w-5 h-5 shrink-0" />
              {{ $t('orders.cancelled_branch') }}
            </div>
          </div>

          <!-- Items -->
          <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm]">
            <div class="px-5 py-4 border-b border-[--color-border-warm]">
              <p class="text-xs font-semibold uppercase tracking-widest text-[--color-bark-light]">
                {{ $t('orders.items_title') }}
              </p>
            </div>
            <div class="px-5 py-4 space-y-3">
              <div
                v-for="item in order.items"
                :key="item.id"
                class="flex items-center justify-between gap-4"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <img
                    v-if="item.product?.images?.[0]"
                    :src="item.product.images[0]"
                    :alt="itemName(item)"
                    class="w-12 h-12 rounded-lg object-cover shrink-0 bg-[--color-surface-page]"
                    @error="(e: Event) => ((e.target as HTMLImageElement).src = '/images/placeholder-product.svg')"
                  >
                  <div
                    v-else
                    class="w-12 h-12 rounded-lg bg-[--color-surface-page] flex items-center justify-center shrink-0"
                  >
                    <span class="text-lg">📦</span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm text-[--color-bark] truncate">{{ itemName(item) }}</p>
                    <p class="text-xs text-[--color-bark-light]">
                      x{{ item.quantity }} · {{ currencySymbol }}{{ Number(item.unit_price).toFixed(2) }}
                    </p>
                  </div>
                </div>
                <span class="text-sm font-medium text-[--color-bark] shrink-0">
                  {{ currencySymbol }}{{ (Number(item.unit_price) * item.quantity).toFixed(2) }}
                </span>
              </div>
            </div>
            <!-- Totals -->
            <div class="border-t border-[--color-border-warm] px-5 py-4 space-y-1.5 text-sm">
              <div class="flex justify-between text-[--color-bark-light]">
                <span>{{ $t('orders.subtotal') }}</span><span>{{ currencySymbol }}{{ Number(order.subtotal).toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-[--color-bark-light]">
                <span>{{ $t('orders.shipping') }}</span>
                <span>{{ Number(order.shipping_cost) > 0 ? `${currencySymbol}${Number(order.shipping_cost).toFixed(2)}` : $t('checkout.free_shipping') }}</span>
              </div>
              <div v-if="Number(order.loyalty_discount) > 0" class="flex justify-between text-[--color-bark-light]">
                <span>{{ $t('orders.discount') }}</span><span>−{{ currencySymbol }}{{ Number(order.loyalty_discount).toFixed(2) }}</span>
              </div>
              <div class="flex justify-between font-semibold text-[--color-bark] pt-1.5 border-t border-[--color-border-warm]">
                <span>{{ $t('orders.total') }}</span><span>{{ currencySymbol }}{{ Number(order.total).toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <!-- Fulfilment + payment -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5 text-sm">
              <p class="text-xs font-semibold uppercase tracking-widest text-[--color-bark-light] mb-2">
                {{ $t('orders.fulfilment') }}
              </p>
              <p class="font-medium text-[--color-bark]">{{ $t(`orders.fulfilment_${order.fulfillment_type}`) }}</p>
              <address v-if="order.shipping_address" class="not-italic text-[--color-bark-light] mt-2 leading-relaxed">
                {{ order.shipping_address.full_name }}<br>
                {{ order.shipping_address.address }}<br>
                {{ order.shipping_address.postal_code }} {{ order.shipping_address.city }}<br>
                {{ order.shipping_address.phone }}
              </address>
            </div>
            <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5 text-sm">
              <p class="text-xs font-semibold uppercase tracking-widest text-[--color-bark-light] mb-2">
                {{ $t('orders.payment') }}
              </p>
              <p class="font-medium text-[--color-bark]">{{ $t(`orders.payment_${order.payment_method}`) }}</p>
              <p class="text-[--color-bark-light] mt-1">
                {{ $t('orders.payment_status') }}:
                <span class="font-medium text-[--color-bark]">{{ $t(`orders.payment_status_${order.payment_status}`) }}</span>
              </p>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="order.notes" class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5 text-sm">
            <p class="text-xs font-semibold uppercase tracking-widest text-[--color-bark-light] mb-2">{{ $t('orders.notes') }}</p>
            <p class="text-[--color-bark] whitespace-pre-line">{{ order.notes }}</p>
          </div>

          <div class="flex flex-col sm:flex-row sm:justify-end gap-3">
            <!-- Only while the API says so: pending and unpaid -->
            <UButton
              v-if="order.can_cancel"
              :label="$t('orders.cancel_order')"
              icon="i-heroicons-x-circle"
              color="error"
              variant="outline"
              :loading="cancelling"
              :disabled="cancelling"
              data-action="cancel-order"
              @click="cancelOrder"
            />
            <UButton
              :label="$t('orders.repeat')"
              icon="i-heroicons-arrow-path"
              variant="outline"
              :disabled="cancelling"
              @click="repeatOrder(order)"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Order } from '#shop/types'
import type { LifecycleStep } from '#shop/composables/useOrderPresentation'

definePageMeta({ middleware: 'auth' })

const api = useApi()
const route = useRoute()
const localePath = useLocalePath()
const { statusColor, lifecycleSteps, itemName, formatDate, repeatOrder } = useOrderPresentation()
const { currencySymbol } = useCurrency()

const { t } = useI18n()
const toast = useToast()

const id = computed(() => String(route.params.id))
const notFound = ref(false)
const error = ref(false)
const cancelling = ref(false)

// GET /orders/:id is owner-scoped on the server: another customer's id (or a
// guest order) comes back as 404, so nothing foreign is ever rendered here.
const { data: order, pending, refresh } = useAsyncData(
  () => `order-${id.value}`,
  () =>
    api<Order>(`/orders/${id.value}`).catch((e: unknown) => {
      const status = (e as { status?: number; statusCode?: number })?.status ?? (e as { statusCode?: number })?.statusCode
      if (status === 404) notFound.value = true
      else error.value = true
      return null
    }),
  { server: false, lazy: true, watch: [id] },
)

const steps = computed<LifecycleStep[]>(() => (order.value ? lifecycleSteps(order.value.status) : []))

async function cancelOrder() {
  if (cancelling.value || !order.value) return
  if (!confirm(t('orders.cancel_confirm'))) return
  cancelling.value = true
  try {
    await api(`/orders/${id.value}/cancel`, { method: 'POST' })
    toast.add({ title: t('orders.cancelled_success'), color: 'success', icon: 'i-heroicons-check-circle' })
    // The detail re-reads the order (CANCELLED, lifecycle branch, no cancel
    // button); the cached order list is refreshed so it is current on return.
    await refresh()
    await refreshNuxtData('orders')
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string | string[] } })?.data?.message
    toast.add({ title: (Array.isArray(msg) ? msg[0] : msg) ?? t('orders.cancel_failed'), color: 'error', icon: 'i-heroicons-exclamation-circle' })
    await refresh()
  } finally {
    cancelling.value = false
  }
}

function stepClass(state: LifecycleStep['state']) {
  if (state === 'done') return 'bg-terracotta border-terracotta text-white'
  if (state === 'current') return 'bg-[--color-surface-card] border-terracotta text-terracotta'
  return 'bg-[--color-surface-card] border-[--color-border-warm] text-[--color-bark-light]'
}
</script>
