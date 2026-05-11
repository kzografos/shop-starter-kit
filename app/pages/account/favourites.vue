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
            {{ $t('favourites.title') }}
          </h1>
          <p class="text-sm text-[--color-bark-light] mt-1">{{ $t('favourites.subtitle') }}</p>
        </div>

        <!-- Loading -->
        <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <USkeleton v-for="n in 6" :key="n" class="aspect-3/4 rounded-2xl" />
        </div>

        <!-- Products -->
        <ProductGrid v-else-if="products && products.length > 0" :products="products" />

        <!-- Empty -->
        <div v-else class="flex flex-col items-center justify-center py-24 text-center">
          <UIcon name="i-heroicons-heart" class="w-16 h-16 text-[--color-bark-light] mb-4" />
          <p class="text-[--color-bark-light] max-w-sm">{{ $t('favourites.empty') }}</p>
          <NuxtLink
            :to="localePath('/products')"
            class="mt-6 px-6 py-2.5 rounded-full bg-terracotta text-white text-sm font-semibold hover:bg-terracotta-dark transition-colors"
          >
            {{ $t('nav.products') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { Product } from '~~/types'

definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const localePath = useLocalePath()
const { t } = useI18n()
const favouritesStore = useFavouritesStore()

const { data: products, pending } = await useAsyncData('favourites', async () => {
  if (!favouritesStore.ids.length) return []
  const supabase = useSupabaseClient<Database>()
  const { data } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .in('id', favouritesStore.ids)
    .eq('is_active', true)
  return (data ?? []) as Product[]
}, { watch: [() => favouritesStore.ids.length] })

useSeoMeta({ title: () => `${t('favourites.title')} | PetShop CY` })
</script>
