<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-8">{{ $t('admin.orders') }}</h1>

    <UCard>
      <div v-if="pending" class="space-y-3">
        <USkeleton v-for="n in 5" :key="n" class="h-12 rounded" />
      </div>

      <UTable v-else :rows="orders ?? []" :columns="columns">
        <template #status-data="{ row }">
          <USelect
            :model-value="row.status"
            :items="statusOptions"
            size="xs"
            @update:model-value="updateStatus(row.id, $event)"
          />
        </template>
        <template #payment_status-data="{ row }">
          <UBadge
            :label="row.payment_status"
            :color="row.payment_status === 'paid' ? 'success' : 'warning'"
            variant="subtle"
          />
        </template>
        <template #total-data="{ row }">
          <span class="font-medium">€{{ Number(row.total).toFixed(2) }}</span>
        </template>
        <template #created_at-data="{ row }">
          <span class="text-sm text-gray-500">
            {{ new Date(row.created_at).toLocaleDateString('el-GR') }}
          </span>
        </template>
        <template #fulfillment_type-data="{ row }">
          <UBadge
            :label="row.fulfillment_type"
            :color="row.fulfillment_type === 'pickup' ? 'info' : 'neutral'"
            variant="subtle"
          />
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const supabase = useSupabaseClient()
const { t } = useI18n()

const columns = [
  { key: 'id', label: 'ID', formatter: (v: string) => v.slice(0, 8).toUpperCase() },
  { key: 'created_at', label: t('orders.date') },
  { key: 'fulfillment_type', label: 'Τύπος' },
  { key: 'payment_status', label: 'Πληρωμή' },
  { key: 'total', label: t('orders.total') },
  { key: 'status', label: t('orders.status') },
]

const statusOptions = [
  { label: t('orders.status_pending'), value: 'pending' },
  { label: t('orders.status_confirmed'), value: 'confirmed' },
  { label: t('orders.status_processing'), value: 'processing' },
  { label: t('orders.status_ready'), value: 'ready' },
  { label: t('orders.status_completed'), value: 'completed' },
  { label: t('orders.status_cancelled'), value: 'cancelled' },
]

const { data: orders, pending, refresh } = await useAsyncData('admin-orders', async () => {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  return data
})

async function updateStatus(orderId: string, status: string) {
  await supabase.from('orders').update({ status }).eq('id', orderId)
  refresh()
}
</script>
