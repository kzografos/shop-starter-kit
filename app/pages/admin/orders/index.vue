<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-8">{{ $t('admin.orders') }}</h1>

    <UCard>
      <div v-if="pending" class="space-y-3">
        <USkeleton v-for="n in 5" :key="n" class="h-12 rounded" />
      </div>

      <UTable v-else :data="orders ?? []" :columns="columns">
        <template #status-cell="{ row }">
          <USelect
            :model-value="row.original.status"
            :items="statusOptions"
            size="xs"
            @update:model-value="updateStatus(row.original.id, $event)"
          />
        </template>
        <template #payment_status-cell="{ row }">
          <UBadge
            :label="row.original.payment_status"
            :color="row.original.payment_status === 'paid' ? 'success' : 'warning'"
            variant="subtle"
          />
        </template>
        <template #total-cell="{ row }">
          <span class="font-medium">€{{ Number(row.original.total).toFixed(2) }}</span>
        </template>
        <template #created_at-cell="{ row }">
          <span class="text-sm text-gray-500">
            {{ new Date(row.original.created_at).toLocaleDateString('el-GR') }}
          </span>
        </template>
        <template #fulfillment_type-cell="{ row }">
          <UBadge
            :label="row.original.fulfillment_type"
            :color="row.original.fulfillment_type === 'pickup' ? 'info' : 'neutral'"
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
  { accessorKey: 'id', header: 'ID', cell: ({ row }: { row: { original: { id: string } } }) => row.original.id.slice(0, 8).toUpperCase() },
  { accessorKey: 'created_at', header: t('orders.date') },
  { accessorKey: 'fulfillment_type', header: 'Τύπος' },
  { accessorKey: 'payment_status', header: 'Πληρωμή' },
  { accessorKey: 'total', header: t('orders.total') },
  { accessorKey: 'status', header: t('orders.status') },
]

const statusOptions = [
  { label: t('orders.status_pending'), value: 'pending' },
  { label: t('orders.status_confirmed'), value: 'confirmed' },
  { label: t('orders.status_processing'), value: 'processing' },
  { label: t('orders.status_ready'), value: 'ready' },
  { label: t('orders.status_completed'), value: 'completed' },
  { label: t('orders.status_cancelled'), value: 'cancelled' },
]

const { data: orders, pending, refresh } = useAsyncData('admin-orders', async () => {
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
