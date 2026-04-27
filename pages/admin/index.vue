<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-8">{{ $t('admin.dashboard') }}</h1>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <UIcon name="i-heroicons-tag" class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">{{ $t('admin.products') }}</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.products }}</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <UIcon name="i-heroicons-shopping-bag" class="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">{{ $t('admin.orders') }}</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.orders }}</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Low Stock</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.lowStock }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Recent orders -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">{{ $t('admin.orders') }}</h2>
          <UButton :label="$t('common.back')" variant="ghost" :to="localePath('/admin/orders')" />
        </div>
      </template>
      <p class="text-sm text-gray-500">{{ $t('common.loading') }}</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const supabase = useSupabaseClient()
const localePath = useLocalePath()

const stats = reactive({ products: 0, orders: 0, lowStock: 0 })

onMounted(async () => {
  const [products, orders, lowStock] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).lt('stock', 5).gt('stock', 0),
  ])
  stats.products = products.count ?? 0
  stats.orders = orders.count ?? 0
  stats.lowStock = lowStock.count ?? 0
})
</script>
