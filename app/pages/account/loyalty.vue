<template>
  <div class="bg-surface-page min-h-screen">
    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 max-w-6xl mx-auto px-4 py-10">
      <!-- TODO: extract to AppAccountSidebar component -->
      <aside
        class="h-fit sticky top-6 bg-[--color-surface-card] rounded-2xl border border-[--color-border-warm] p-6"
      >
        <!-- Avatar + name -->
        <div class="flex flex-col items-center text-center mb-6">
          <div class="w-16 h-16 rounded-full bg-terracotta flex items-center justify-center mb-3">
            <span class="font-display text-2xl font-bold text-white">
              {{
                (authStore.profile?.full_name || authStore.profile?.email || '?')[0].toUpperCase()
              }}
            </span>
          </div>
          <p class="text-xs text-[--color-bark-light] mb-0.5">Καλώς ήρθατε</p>
          <p class="font-display font-bold text-[--color-bark] text-base leading-tight">
            {{ authStore.profile?.full_name || authStore.profile?.email }}
          </p>
        </div>

        <!-- Nav -->
        <nav class="flex flex-col gap-1 mb-6">
          <NuxtLink
            :to="localePath('/account')"
            class="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            :class="
              $route.path === localePath('/account')
                ? 'bg-terracotta text-white'
                : 'text-[--color-bark-light] hover:bg-[--color-surface-page] hover:text-[--color-bark]'
            "
          >
            <span>🏠</span> {{ $t('account.title') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/account/orders')"
            class="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            :class="
              $route.path.includes('/account/orders')
                ? 'bg-terracotta text-white'
                : 'text-[--color-bark-light] hover:bg-[--color-surface-page] hover:text-[--color-bark]'
            "
          >
            <span>📦</span> {{ $t('account.orders') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/account/favourites')"
            class="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            :class="
              $route.path.includes('/account/favourites')
                ? 'bg-terracotta text-white'
                : 'text-[--color-bark-light] hover:bg-[--color-surface-page] hover:text-[--color-bark]'
            "
          >
            <span>❤️</span> {{ $t('account.favourites') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/account/loyalty')"
            class="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            :class="
              $route.path.includes('/account/loyalty')
                ? 'bg-terracotta text-white'
                : 'text-[--color-bark-light] hover:bg-[--color-surface-page] hover:text-[--color-bark]'
            "
          >
            <span>⭐</span> {{ $t('account.loyalty') }}
          </NuxtLink>
        </nav>

        <div class="h-px bg-[--color-border-warm] mb-4" />

        <button
          class="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-terracotta hover:bg-[--color-surface-page] transition-colors text-left cursor-pointer border border-transparent hover:border-terracotta"
          @click="authStore.signOut()"
        >
          {{ $t('nav.logout') }}
        </button>
      </aside>

      <!-- Main content -->
      <div class="flex flex-col gap-6">
        <div>
          <h1 class="font-display text-3xl font-bold text-[--color-bark]">
            {{ $t('account.loyalty') }}
          </h1>
          <p class="text-sm text-[--color-bark-light] mt-1">{{ $t('loyalty.subtitle') }}</p>
        </div>

        <!-- Points card -->
        <div class="bg-forest rounded-2xl p-8">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div class="flex-1">
              <p class="text-xs font-semibold uppercase tracking-widest text-sage mb-2">
                {{ $t('loyalty.your_points') }}
              </p>
              <p class="font-display text-5xl font-bold text-white mb-1">
                {{ authStore.loyaltyPoints.toLocaleString() }}
              </p>
              <p class="text-sm text-white/60 mb-6">{{ $t('loyalty.points') }}</p>
              <div class="max-w-sm">
                <div class="flex justify-between text-xs text-white/50 mb-2">
                  <span>{{ authStore.loyaltyPoints.toLocaleString() }} {{ $t('loyalty.points') }}</span>
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
          </div>
        </div>

        <!-- Info cards -->
        <div class="grid sm:grid-cols-2 gap-4">
          <div
            class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5 flex items-start gap-3"
          >
            <div
              class="w-9 h-9 rounded-lg bg-terracotta/10 flex items-center justify-center shrink-0"
            >
              <UIcon name="i-heroicons-arrow-trending-up" class="w-5 h-5 text-terracotta" />
            </div>
            <div>
              <h3 class="font-semibold text-[--color-bark] mb-1">{{ $t('loyalty.earned') }}</h3>
              <p class="text-sm text-[--color-bark-light]">{{ $t('loyalty.earn_info') }}</p>
            </div>
          </div>
          <div
            class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5 flex items-start gap-3"
          >
            <div
              class="w-9 h-9 rounded-lg bg-[--color-gold]/20 flex items-center justify-center shrink-0"
            >
              <UIcon name="i-heroicons-gift" class="w-5 h-5 text-[--color-gold]" />
            </div>
            <div>
              <h3 class="font-semibold text-[--color-bark] mb-1">{{ $t('loyalty.redeemed') }}</h3>
              <p class="text-sm text-[--color-bark-light]">{{ $t('loyalty.redeem_info') }}</p>
            </div>
          </div>
        </div>

        <!-- Transaction history -->
        <div>
          <h2 class="font-display text-xl font-bold text-[--color-bark] mb-4">
            {{ $t('loyalty.history') }}
          </h2>

          <div v-if="pending" class="space-y-2">
            <USkeleton v-for="n in 4" :key="n" class="h-14 rounded-xl" />
          </div>

          <div v-else-if="transactions && transactions.length > 0" class="space-y-2">
            <div
              v-for="tx in transactions"
              :key="tx.id"
              class="flex items-center justify-between p-4 bg-[--color-surface-card] rounded-xl border border-[--color-border-warm]"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  :class="tx.type === 'earn' ? 'bg-terracotta/10' : 'bg-[--color-warm-red]/10'"
                >
                  <UIcon
                    :name="tx.type === 'earn' ? 'i-heroicons-plus' : 'i-heroicons-minus'"
                    :class="tx.type === 'earn' ? 'text-terracotta' : 'text-[--color-warm-red]'"
                    class="w-4 h-4"
                  />
                </div>
                <div>
                  <p class="text-sm font-medium text-[--color-bark]">
                    {{ tx.type === 'earn' ? $t('loyalty.earned') : $t('loyalty.redeemed') }}
                  </p>
                  <p class="text-xs text-[--color-bark-light]">
                    {{ tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '' }}
                  </p>
                </div>
              </div>
              <span
                class="font-bold text-sm"
                :class="tx.type === 'earn' ? 'text-terracotta' : 'text-[--color-warm-red]'"
              >
                {{ tx.points_delta > 0 ? '+' : '' }}{{ tx.points_delta }} pts
              </span>
            </div>
          </div>

          <div v-else class="text-center py-12 text-[--color-bark-light] text-sm">
            {{ $t('loyalty.no_history') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ middleware: 'auth' })

const user = useSupabaseUser()
const authStore = useAuthStore()
const localePath = useLocalePath()

const { data: transactions, pending } = await useAsyncData('loyalty-transactions', async () => {
  if (!user.value) return []
  const supabase = useSupabaseClient<Database>()
  const { data } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('user_id', user.value.sub)
    .order('created_at', { ascending: false })
  return data ?? []
})

onMounted(() => authStore.fetchProfile())
</script>
