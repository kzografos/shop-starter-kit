<template>
  <div class="bg-[--color-surface-page] min-h-screen">
    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 max-w-6xl mx-auto px-4 py-10">

      <!-- Sidebar -->
      <aside class="h-fit bg-[--color-surface-card] rounded-2xl border border-[--color-border-warm] p-6">

        <!-- Avatar + name -->
        <div class="flex flex-col items-center text-center mb-6">
          <div class="w-16 h-16 rounded-full bg-terracotta flex items-center justify-center mb-3">
            <span class="font-display text-2xl font-bold text-white">
              {{ (authStore.profile?.full_name || authStore.profile?.email || '?')[0].toUpperCase() }}
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
            :class="$route.path === localePath('/account')
              ? 'bg-terracotta text-white'
              : 'text-[--color-bark-light] hover:bg-[--color-surface-page] hover:text-[--color-bark]'"
          >
            <span>🏠</span> {{ $t('account.title') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/account/orders')"
            class="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            :class="$route.path.includes('/account/orders')
              ? 'bg-terracotta text-white'
              : 'text-[--color-bark-light] hover:bg-[--color-surface-page] hover:text-[--color-bark]'"
          >
            <span>📦</span> {{ $t('account.orders') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/account/favourites')"
            class="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            :class="$route.path.includes('/account/favourites')
              ? 'bg-terracotta text-white'
              : 'text-[--color-bark-light] hover:bg-[--color-surface-page] hover:text-[--color-bark]'"
          >
            <span>❤️</span> {{ $t('account.favourites') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/account/loyalty')"
            class="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            :class="$route.path.includes('/account/loyalty')
              ? 'bg-terracotta text-white'
              : 'text-[--color-bark-light] hover:bg-[--color-surface-page] hover:text-[--color-bark]'"
          >
            <span>⭐</span> {{ $t('account.loyalty') }}
          </NuxtLink>
        </nav>

        <div class="h-px bg-[--color-border-warm] mb-4" />

        <button
          class="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-terracotta hover:bg-[--color-surface-page] transition-colors text-left"
          @click="authStore.signOut()"
        >
          {{ $t('nav.logout') }}
        </button>
      </aside>

      <!-- Main content -->
      <div class="flex flex-col gap-6">

        <!-- Loyalty card -->
        <div class="bg-forest rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-sage mb-2">
              {{ $t('account.loyalty') }}
            </p>
            <p class="font-display text-4xl font-bold text-white mb-2">
              {{ authStore.loyaltyPoints }}
            </p>
            <p class="text-sm text-sage max-w-xs leading-relaxed">
              {{ $t('loyalty.redeem_info') }}
            </p>
          </div>
          <NuxtLink
            :to="localePath('/account/loyalty')"
            class="shrink-0 px-5 py-2.5 rounded-xl border border-white/40 text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Εξαργύρωση
          </NuxtLink>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5 text-center">
            <p class="font-display text-2xl font-bold text-[--color-bark]">—</p>
            <p class="text-xs text-[--color-bark-light] mt-1">{{ $t('account.orders') }}</p>
          </div>
          <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5 text-center">
            <p class="font-display text-2xl font-bold text-[--color-bark]">{{ favouritesStore.ids.length }}</p>
            <p class="text-xs text-[--color-bark-light] mt-1">{{ $t('account.favourites') }}</p>
          </div>
          <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-5 text-center">
            <p class="font-display text-2xl font-bold text-[--color-bark]">{{ authStore.loyaltyPoints }}</p>
            <p class="text-xs text-[--color-bark-light] mt-1">{{ $t('loyalty.points') }}</p>
          </div>
        </div>

        <!-- Quick links -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-6">
            <div class="text-2xl mb-3">📦</div>
            <h3 class="font-display font-bold text-[--color-bark] text-lg mb-1">{{ $t('account.orders') }}</h3>
            <p class="text-sm text-[--color-bark-light] mb-4">{{ $t('account.no_orders') }}</p>
            <NuxtLink
              :to="localePath('/account/orders')"
              class="text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors"
            >
              Προβολή →
            </NuxtLink>
          </div>
          <div class="bg-[--color-surface-card] rounded-xl border border-[--color-border-warm] p-6">
            <div class="text-2xl mb-3">❤️</div>
            <h3 class="font-display font-bold text-[--color-bark] text-lg mb-1">{{ $t('account.favourites') }}</h3>
            <p class="text-sm text-[--color-bark-light] mb-4">
              {{ favouritesStore.ids.length > 0
                ? $t('account.favourites_count', { count: favouritesStore.ids.length }, favouritesStore.ids.length)
                : $t('account.favourites_empty') }}
            </p>
            <NuxtLink
              :to="localePath('/account/favourites')"
              class="text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors"
            >
              Προβολή →
            </NuxtLink>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const favouritesStore = useFavouritesStore()
const localePath = useLocalePath()

onMounted(() => authStore.fetchProfile())
</script>
