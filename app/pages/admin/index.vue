<template>
  <div class="p-8 space-y-8">
    <h1 class="text-2xl font-bold text-gray-900">{{ $t('admin.dashboard') }}</h1>

    <!-- KPI Cards -->
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-banknotes" class="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wide">Συνολικά Έσοδα</p>
            <p class="text-2xl font-bold text-gray-900">€{{ kpi.totalRevenue.toFixed(0) }}</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-calendar-days" class="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wide">Έσοδα Μήνα</p>
            <p class="text-2xl font-bold text-gray-900">€{{ kpi.monthRevenue.toFixed(0) }}</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-users" class="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wide">Πελάτες</p>
            <p class="text-2xl font-bold text-gray-900">{{ kpi.totalCustomers }}</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-11 h-11 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-user-plus" class="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wide">Νέοι Μήνα</p>
            <p class="text-2xl font-bold text-gray-900">{{ kpi.newCustomers }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Charts Row -->
    <div class="grid lg:grid-cols-3 gap-6">
      <!-- Revenue Line Chart -->
      <UCard class="lg:col-span-2">
        <template #header>
          <h2 class="font-semibold text-gray-800">Έσοδα τελευταίων 30 ημερών</h2>
        </template>
        <div v-if="loading" class="h-48 flex items-center justify-center">
          <USkeleton class="w-full h-48 rounded" />
        </div>
        <LineChart
          v-else
          :data="revenueChartData"
          :height="192"
          :categories="revenueCategories"
          :y-formatter="(v: any) => `€${Number(v).toFixed(0)}`"
          :x-formatter="revenueXFormatter"
          :x-num-ticks="6"
        />
      </UCard>

      <!-- Orders by Status Donut -->
      <UCard>
        <template #header>
          <h2 class="font-semibold text-gray-800">Παραγγελίες ανά Κατάσταση</h2>
        </template>
        <div v-if="loading" class="h-48 flex items-center justify-center">
          <USkeleton class="w-40 h-40 rounded-full mx-auto" />
        </div>
        <template v-else>
          <DonutChart
            v-if="donutNumbers.length"
            :data="donutNumbers"
            :radius="80"
            :height="192"
            :categories="donutCategories"
          />
          <p v-else class="text-sm text-gray-400 text-center py-8">Δεν υπάρχουν δεδομένα</p>
        </template>
      </UCard>
    </div>

    <!-- Bottom Row: Top Products + Low Stock + Recent Orders -->
    <div class="grid lg:grid-cols-3 gap-6">
      <!-- Top 5 Products -->
      <UCard>
        <template #header>
          <h2 class="font-semibold text-gray-800">Top 5 Προϊόντα</h2>
        </template>
        <div v-if="loading" class="space-y-2">
          <USkeleton v-for="n in 5" :key="n" class="h-8 rounded" />
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="(p, i) in topProducts"
            :key="p.name"
            class="flex items-center gap-3"
          >
            <span class="text-xs font-bold text-gray-400 w-4">{{ i + 1 }}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">{{ p.name }}</p>
              <div class="h-1.5 bg-gray-100 rounded-full mt-1">
                <div
                  class="h-1.5 bg-primary-500 rounded-full"
                  :style="{ width: `${(p.units / topProducts[0].units) * 100}%` }"
                />
              </div>
            </div>
            <span class="text-sm font-semibold text-gray-600 shrink-0">{{ p.units }} τεμ.</span>
          </div>
          <p v-if="!topProducts.length" class="text-sm text-gray-400 text-center py-4">Δεν υπάρχουν δεδομένα</p>
        </div>
      </UCard>

      <!-- Low Stock -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-gray-800">Χαμηλό Απόθεμα</h2>
            <UBadge :label="`${lowStock.length}`" color="warning" variant="subtle" />
          </div>
        </template>
        <div v-if="loading" class="space-y-2">
          <USkeleton v-for="n in 5" :key="n" class="h-8 rounded" />
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="p in lowStock"
            :key="p.id"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-700 truncate">{{ p.name_el }}</span>
            <UBadge
              :label="`${p.stock} τεμ.`"
              :color="p.stock === 0 ? 'error' : 'warning'"
              variant="subtle"
              size="sm"
            />
          </div>
          <p v-if="!lowStock.length" class="text-sm text-gray-400 text-center py-4">Όλα τα αποθέματα OK</p>
        </div>
      </UCard>

      <!-- Recent Orders -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-gray-800">{{ $t('admin.orders') }}</h2>
            <UButton label="Όλες" variant="ghost" size="xs" :to="localePath('/admin/orders')" />
          </div>
        </template>
        <div v-if="loading" class="space-y-2">
          <USkeleton v-for="n in 5" :key="n" class="h-10 rounded" />
        </div>
        <div v-else-if="!recentOrders.length" class="text-sm text-gray-400 py-4 text-center">
          Δεν υπάρχουν παραγγελίες ακόμα.
        </div>
        <div v-else class="divide-y divide-gray-100">
          <div
            v-for="order in recentOrders"
            :key="order.id"
            class="flex items-center justify-between py-2.5 text-sm"
          >
            <span class="font-mono text-gray-500 text-xs">{{ order.id.slice(0, 8).toUpperCase() }}</span>
            <UBadge :label="order.status" :color="statusColor(order.status)" variant="subtle" size="sm" />
            <span class="font-semibold text-gray-800">€{{ Number(order.total).toFixed(2) }}</span>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { public: { apiBase } } = useRuntimeConfig()
const localePath = useLocalePath()

const loading = ref(true)

const kpi = reactive({ totalRevenue: 0, monthRevenue: 0, totalCustomers: 0, newCustomers: 0 })
const recentOrders = ref<Array<{ id: string; status: string; total: number; created_at: string }>>([])
const revenueChartData = ref<{ 'Έσοδα': number }[]>([])
const revenueDates = ref<string[]>([])
const orderStatusData = ref<{ status: string; count: number }[]>([])
const topProducts = ref<{ name: string; units: number }[]>([])
const lowStock = ref<{ id: string; name_el: string; stock: number }[]>([])

const revenueCategories = { 'Έσοδα': { name: 'Έσοδα', color: '#10b981' } }

const donutNumbers = computed(() => orderStatusData.value.map(o => o.count))
const donutCategories = computed(() => {
  const colors: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#3b82f6', processing: '#6366f1',
    ready: '#10b981', completed: '#22c55e', cancelled: '#ef4444',
  }
  return Object.fromEntries(
    orderStatusData.value.map(o => [o.status, { name: o.status, color: colors[o.status] ?? '#6b7280' }])
  )
})

function revenueXFormatter(_: unknown, i: number) {
  return revenueDates.value[i] ?? ''
}

onMounted(async () => {
  const stats = await $fetch<{
    total_revenue: number
    month_revenue: number
    total_customers: number
    new_customers: number
    recent_orders: Array<{ id: string; status: string; total: number; created_at: string }>
    last_30_days: Array<{ date: string; total: number }>
    order_status_breakdown: Array<{ status: string; count: number }>
    top_products: Array<{ name: string; units: number }>
    low_stock: Array<{ id: string; name_el: string; stock: number }>
  }>(`${apiBase}/admin/stats`, { credentials: 'include' })

  kpi.totalRevenue = stats.total_revenue
  kpi.monthRevenue = stats.month_revenue
  kpi.totalCustomers = stats.total_customers
  kpi.newCustomers = stats.new_customers

  recentOrders.value = stats.recent_orders
  topProducts.value = stats.top_products
  lowStock.value = stats.low_stock
  orderStatusData.value = stats.order_status_breakdown

  // Build 30-day revenue chart
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const dayMap = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo)
    d.setDate(d.getDate() + i)
    dayMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const o of stats.last_30_days) {
    if (dayMap.has(o.date)) dayMap.set(o.date, (dayMap.get(o.date) ?? 0) + o.total)
  }
  revenueDates.value = Array.from(dayMap.keys()).map(d => d.slice(5))
  revenueChartData.value = Array.from(dayMap.values()).map(v => ({ 'Έσοδα': v }))

  loading.value = false
})

function statusColor(status: string) {
  const map: Record<string, string> = {
    pending: 'warning', confirmed: 'info', processing: 'info',
    ready: 'success', completed: 'success', cancelled: 'error',
  }
  return map[status] ?? 'neutral'
}
</script>
