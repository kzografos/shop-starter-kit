<template>
  <!-- Stats strip -->
  <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5">
    <div class="grid grid-cols-3 divide-x divide-[--color-border-warm]">
      <div class="text-center px-4">
        <p class="font-display text-2xl font-bold text-[--color-bark]">
          {{ orderCount ?? '—' }}
        </p>
        <p class="text-xs text-[--color-bark-light] mt-1">{{ $t('account.orders') }}</p>
      </div>
      <div class="text-center px-4">
        <p class="font-display text-2xl font-bold text-[--color-bark]">
          {{ ids.length }}
        </p>
        <p class="text-xs text-[--color-bark-light] mt-1">{{ $t('account.favourites') }}</p>
      </div>
      <div class="text-center px-4">
        <p class="font-display text-2xl font-bold text-[--color-bark]">
          {{ loyaltyPoints.toLocaleString() }}
        </p>
        <p class="text-xs text-[--color-bark-light] mt-1">{{ $t('loyalty.points') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Shop dashboard stats (orders, favourites, loyalty). Contributed to the account
// dashboard through app.config `accountCards` (registered globally).
const api = useApi()
const authStore = useAuthStore()
const favouritesStore = useFavouritesStore()
const { loyaltyPoints } = storeToRefs(authStore)
const { ids } = storeToRefs(favouritesStore)

const orderCount = ref<number | null>(null)

onMounted(async () => {
  const orders = await api<Array<{ id: string }>>('/orders').catch(() => [])
  orderCount.value = orders.length
})
</script>
