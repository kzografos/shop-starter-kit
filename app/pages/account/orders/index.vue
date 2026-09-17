<template>
  <div class="bg-surface-page min-h-screen">
    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 max-w-6xl mx-auto px-4 py-10">
      <AccountSidebar />

      <!-- Main content -->
      <div class="flex flex-col gap-6">
        <div>
          <h1 class="font-display text-3xl font-bold text-[--color-bark]">
            {{ $t('account.orders') }}
          </h1>
          <p class="text-sm text-[--color-bark-light] mt-1">{{ $t('orders.subtitle') }}</p>
        </div>

        <!-- Loading -->
        <div v-if="pending" class="space-y-4">
          <USkeleton v-for="n in 3" :key="n" class="h-24 rounded-xl" />
        </div>

        <!-- Error -->
        <div v-else-if="error" class="text-center py-12 text-danger">
          {{ error }}
        </div>

        <!-- Empty -->
        <div v-else-if="!orders || orders.length === 0" class="text-center py-20">
          <UIcon
            name="i-heroicons-shopping-bag"
            class="w-16 h-16 text-[--color-bark-light] mx-auto mb-4"
          />
          <p class="text-[--color-bark-light]">{{ $t('account.no_orders') }}</p>
          <UButton :label="$t('home.shop_now')" :to="localePath('/products')" class="mt-4" />
        </div>

        <!-- Orders list -->
        <div v-else class="space-y-4">
          <div
            v-for="order in orders"
            :key="order.id"
            class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] overflow-hidden transition-colors hover:border-terracotta"
          >
            <!-- Order header — clickable to toggle -->
            <button
              class="w-full text-left p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              @click="toggleOrder(order.id)"
            >
              <div class="space-y-1">
                <div class="flex items-center gap-3 flex-wrap">
                  <NuxtLink
                    :to="localePath(`/account/orders/${order.id}`)"
                    class="font-display font-bold text-[--color-bark] hover:text-terracotta transition-colors"
                    @click.stop
                  >
                    #{{ order.id.slice(0, 8).toUpperCase() }}
                  </NuxtLink>
                  <UBadge
                    :label="$t(`orders.status_${order.status}`)"
                    :color="statusColor(order.status)"
                    variant="subtle"
                    size="sm"
                  />
                </div>
                <p class="text-xs text-[--color-bark-light]">{{ formatDate(order.created_at) }}</p>
                <p class="text-sm text-[--color-bark-light]">
                  {{ order.items?.length ?? 0 }} {{ $t('orders.items') }} ·
                  <span class="font-semibold text-[--color-bark]"
                    >€{{ order.total.toFixed(2) }}</span
                  >
                </p>
              </div>
              <UIcon
                name="i-heroicons-chevron-down"
                class="w-5 h-5 text-[--color-bark-light] shrink-0 transition-transform duration-200 self-start sm:self-center"
                :class="isExpanded(order.id) ? 'rotate-180' : ''"
              />
            </button>

            <!-- Expanded items list -->
            <div v-show="isExpanded(order.id)">
              <div class="border-t border-[--color-border-warm] px-5 py-4 space-y-3">
                <div
                  v-for="item in order.items"
                  :key="item.id"
                  class="flex items-center justify-between gap-4"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <img
                      v-if="item.product?.images?.[0]"
                      :src="item.product.images[0]"
                      :alt="locale === 'el' ? item.product.name_el : item.product.name_en"
                      class="w-10 h-10 rounded-lg object-cover shrink-0 bg-[--color-surface-page]"
                      @error="(e: Event) => ((e.target as HTMLImageElement).src = '/images/placeholder-product.svg')"
                    />
                    <div
                      v-else
                      class="w-10 h-10 rounded-lg bg-[--color-surface-page] flex items-center justify-center shrink-0"
                    >
                      <span class="text-lg">📦</span>
                    </div>
                    <span class="text-sm text-[--color-bark] truncate">
                      x{{ item.quantity }} · {{ itemName(item) }}
                    </span>
                  </div>
                  <span class="text-sm font-medium text-[--color-bark] shrink-0">
                    €{{ (item.unit_price * item.quantity).toFixed(2) }}
                  </span>
                </div>
              </div>

              <div class="border-t border-[--color-border-warm] px-5 py-3 flex justify-between items-center gap-4">
                <NuxtLink
                  :to="localePath(`/account/orders/${order.id}`)"
                  class="text-sm font-medium text-[--color-bark-light] hover:text-[--color-bark] transition-colors"
                >
                  {{ $t('orders.view_details') }}
                </NuxtLink>
                <button
                  class="text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors"
                  @click.stop="repeatOrder(order)"
                >
                  {{ $t('orders.repeat') }} →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Order } from '~~/types'

definePageMeta({ middleware: 'auth' })

const api = useApi()
const localePath = useLocalePath()
const { locale } = useI18n()
// Status colours, item names, dates and "repeat order" are shared with the
// detail page (composables/useOrderPresentation.ts).
const { statusColor, itemName, formatDate, repeatOrder } = useOrderPresentation()

const error = ref<string | null>(null)

const { data: orders, pending } = useAsyncData('orders', () =>
  api<Order[]>('/orders').catch(() => {
    error.value = 'Failed to load. Please try again.'
    return [] as Order[]
  }),
  { server: false, lazy: true },
)

const expandedOrders = ref<Set<string>>(new Set())

function toggleOrder(id: string) {
  if (expandedOrders.value.has(id)) {
    expandedOrders.value.delete(id)
  } else {
    expandedOrders.value.add(id)
  }
}

function isExpanded(id: string) {
  return expandedOrders.value.has(id)
}

</script>
