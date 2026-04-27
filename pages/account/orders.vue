<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center gap-4 mb-8">
      <UButton icon="i-heroicons-arrow-left" variant="ghost" :to="localePath('/account')" />
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('account.orders') }}</h1>
    </div>

    <div v-if="pending" class="space-y-4">
      <USkeleton v-for="n in 3" :key="n" class="h-24 rounded-xl" />
    </div>

    <div v-else-if="!orders || orders.length === 0" class="text-center py-20">
      <UIcon name="i-heroicons-shopping-bag" class="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <p class="text-gray-500">{{ $t('account.no_orders') }}</p>
      <UButton :label="$t('home.shop_now')" :to="localePath('/products')" class="mt-4" />
    </div>

    <div v-else class="space-y-4">
      <UCard
        v-for="order in orders"
        :key="order.id"
        class="hover:border-primary-200 transition-colors"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-3">
              <span class="font-medium text-gray-900">
                {{ $t('orders.order_number') }}{{ order.id.slice(0, 8).toUpperCase() }}
              </span>
              <UBadge :label="$t(`orders.status_${order.status}`)" :color="statusColor(order.status)" />
            </div>
            <p class="text-sm text-gray-500">
              {{ new Date(order.created_at).toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-GB') }}
            </p>
            <p class="text-sm font-semibold text-gray-900">€{{ order.total.toFixed(2) }}</p>
          </div>
          <UButton
            :label="$t('orders.repeat')"
            variant="outline"
            size="sm"
            @click="repeatOrder(order)"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Order } from '~/types'

definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const cartStore = useCartStore()
const localePath = useLocalePath()
const { locale } = useI18n()
const router = useRouter()

const { data: orders, pending } = await useAsyncData('orders', async () => {
  const { data } = await supabase
    .from('orders')
    .select('*, items:order_items(*, product:products(*))')
    .eq('user_id', user.value!.id)
    .order('created_at', { ascending: false })
  return data as Order[]
})

function statusColor(status: string) {
  const map: Record<string, string> = {
    pending: 'warning',
    confirmed: 'info',
    processing: 'info',
    ready: 'success',
    completed: 'success',
    cancelled: 'error',
  }
  return map[status] ?? 'neutral'
}

async function repeatOrder(order: Order) {
  if (!order.items) return
  const products = order.items
    .filter(i => i.product && i.product.stock > 0)
    .map(i => ({ product: i.product!, quantity: i.quantity }))
  cartStore.loadFromOrder(products)
  await router.push(localePath('/checkout'))
}
</script>
