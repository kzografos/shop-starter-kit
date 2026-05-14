<template>
  <div>
    <!-- Toolbar -->
    <div class="ac-table-toolbar">
      <div class="ac-table-toolbar-left">
        <div class="ac-search">
          <svg class="ac-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input v-model="search" placeholder="Αναζήτηση παραγγελίας…" />
        </div>
        <select v-model="paymentFilter" class="ac-filter-btn" style="padding-right: 28px;">
          <option value="all">Όλες οι πληρωμές</option>
          <option value="paid">Πληρωμένες</option>
          <option value="pending">Εκκρεμείς</option>
          <option value="failed">Αποτυχημένες</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="ac-card ac-table-card">
      <div v-if="pending" style="padding: 24px 20px; display: flex; flex-direction: column; gap: 10px;">
        <div v-for="n in 8" :key="n" style="height: 50px; background: var(--ac-bg-tint); border-radius: 6px;" />
      </div>

      <table v-else class="ac-data">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>{{ $t('orders.date') }}</th>
            <th>Τύπος</th>
            <th>Πληρωμή</th>
            <th>{{ $t('orders.status') }}</th>
            <th style="text-align: right;">{{ $t('orders.total') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!filteredOrders.length">
            <td colspan="6" class="ac-empty">Δεν βρέθηκαν παραγγελίες</td>
          </tr>
          <tr v-for="order in filteredOrders" :key="order.id">
            <td class="ac-mono ac-nowrap" style="font-weight: 500;">
              {{ order.id.slice(0, 8).toUpperCase() }}
            </td>
            <td class="ac-muted ac-nowrap">
              {{ new Date(order.created_at).toLocaleDateString('el-GR') }}
            </td>
            <td>
              <span
                class="ac-badge"
                :class="order.fulfillment_type === 'pickup' ? 'ac-badge-gold' : 'ac-badge-blue'"
              >
                <span class="ac-badge-dot" />
                {{ order.fulfillment_type === 'pickup' ? 'Παραλαβή' : 'Αποστολή' }}
              </span>
            </td>
            <td>
              <span class="ac-badge" :class="paymentBadgeClass(order.payment_status)">
                <span class="ac-badge-dot" />
                {{ paymentLabel(order.payment_status) }}
              </span>
            </td>
            <td>
              <select
                class="ac-pill-select"
                :value="order.status"
                @change="updateStatus(order.id, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </td>
            <td style="text-align: right; font-weight: 600;">€{{ Number(order.total).toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination placeholder -->
      <div v-if="!pending && filteredOrders.length" class="ac-pagination">
        <div>{{ filteredOrders.length }} παραγγελίες</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { public: { apiBase } } = useRuntimeConfig()
const { t } = useI18n()

const search = ref('')
const paymentFilter = ref('all')

const statusOptions = [
  { label: t('orders.status_pending'),    value: 'pending' },
  { label: t('orders.status_confirmed'),  value: 'confirmed' },
  { label: t('orders.status_processing'), value: 'processing' },
  { label: t('orders.status_ready'),      value: 'ready' },
  { label: t('orders.status_completed'),  value: 'completed' },
  { label: t('orders.status_cancelled'),  value: 'cancelled' },
]

type OrderRow = {
  id: string
  created_at: string
  fulfillment_type: string
  payment_status: string
  total: number
  status: string
}

const { data: orders, pending, refresh } = useAsyncData('admin-orders', () =>
  $fetch<OrderRow[]>(`${apiBase}/admin/orders`, { credentials: 'include' }),
  { server: false }
)

const filteredOrders = computed(() => {
  const list = orders.value ?? []
  const q = search.value.trim().toLowerCase()
  return list.filter(o => {
    if (paymentFilter.value !== 'all' && o.payment_status !== paymentFilter.value) return false
    if (!q) return true
    return o.id.toLowerCase().includes(q)
  })
})

async function updateStatus(orderId: string, status: string) {
  await $fetch(`${apiBase}/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status },
    credentials: 'include',
  })
  refresh()
}

function paymentBadgeClass(status: string) {
  if (status === 'paid')    return 'ac-badge-sage'
  if (status === 'pending') return 'ac-badge-gold'
  return 'ac-badge-red'
}

function paymentLabel(status: string) {
  if (status === 'paid')    return 'Πληρωμένο'
  if (status === 'pending') return 'Εκκρεμεί'
  return 'Απέτυχε'
}
</script>
