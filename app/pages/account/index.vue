<template>
  <div class="bg-surface-page min-h-screen">
    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 max-w-6xl mx-auto px-4 py-10">
      <AccountSidebar />

      <!-- Main content -->
      <div class="flex flex-col gap-6">
        <!-- Welcome header -->
        <div class="mb-2">
          <h1 class="font-display text-3xl font-bold text-[--color-bark]">
            {{ $t('account.greeting') }}, {{ displayName }}.
          </h1>
          <p class="text-sm text-[--color-bark-light] mt-1">
            {{ $t('account.dashboard_subtitle') }}
          </p>
        </div>

        <!-- Loyalty card with progress bar -->
        <div class="bg-forest rounded-2xl p-8">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div class="flex-1">
              <p class="text-xs font-semibold uppercase tracking-widest text-sage mb-2">
                {{ $t('account.loyalty') }}
              </p>
              <p class="font-display text-5xl font-bold text-white mb-1">
                {{ authStore.loyaltyPoints.toLocaleString() }}
              </p>
              <p class="text-sm text-white/60 mb-6">{{ $t('loyalty.points') }}</p>

              <!-- Progress bar -->
              <div class="max-w-sm">
                <div class="flex justify-between text-xs text-white/50 mb-2">
                  <span>{{ authStore.loyaltyPoints }} {{ $t('loyalty.points') }}</span>
                  <span>3,000 {{ $t('loyalty.points') }}</span>
                </div>
                <div class="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-terracotta rounded-full transition-all duration-500"
                    :style="{ width: `${Math.min((authStore.loyaltyPoints / 3000) * 100, 100)}%` }"
                  />
                </div>
                <p class="text-xs text-white/50 mt-2">
                  {{ Math.max(3000 - authStore.loyaltyPoints, 0).toLocaleString() }}
                  {{ $t('account.points_until_reward') }}
                </p>
              </div>
            </div>

            <NuxtLink
              :to="localePath('/account/loyalty')"
              class="shrink-0 self-start px-5 py-2.5 rounded-xl border border-white/30 text-white text-sm font-medium hover:bg-white/10 transition-colors"
            >
              {{ $t('account.redeem') }}
            </NuxtLink>
          </div>
        </div>

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
                {{ favouritesStore.ids.length }}
              </p>
              <p class="text-xs text-[--color-bark-light] mt-1">{{ $t('account.favourites') }}</p>
            </div>
            <div class="text-center px-4">
              <p class="font-display text-2xl font-bold text-[--color-bark]">
                {{ authStore.loyaltyPoints.toLocaleString() }}
              </p>
              <p class="text-xs text-[--color-bark-light] mt-1">{{ $t('loyalty.points') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const api = useApi()
const authStore = useAuthStore()
const favouritesStore = useFavouritesStore()
const localePath = useLocalePath()

const displayName = computed(() => {
  const name = authStore.profile?.full_name
  if (name) return name.split(' ')[0]
  const email = authStore.profile?.email || ''
  return email.split('@')[0]
})

const orderCount = ref<number | null>(null)

onMounted(async () => {
  await authStore.fetchProfile()
  const orders = await api<Array<{ id: string }>>('/orders').catch(() => [])
  orderCount.value = orders.length
})
</script>
