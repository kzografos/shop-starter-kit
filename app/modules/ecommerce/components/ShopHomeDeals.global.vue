<template>
  <!-- Deals -->
  <section v-if="deals.length" class="bg-cream-pale py-16 px-4">
    <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
      <div class="flex items-end justify-between mb-8 gap-4">
        <div>
          <p class="text-terracotta text-xs font-semibold tracking-widest uppercase mb-2">{{ $t('home.deals_eyebrow') }}</p>
          <h2 class="font-display text-3xl sm:text-4xl font-bold text-[--color-bark]">{{ $t('home.deals_title') }}</h2>
        </div>
        <NuxtLink
          :to="{ path: localePath('/products'), query: { onSale: 'true' } }"
          class="shrink-0 hidden sm:inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors"
        >
          {{ $t('home.deals_all') }} <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
        </NuxtLink>
      </div>
      <ShopProductGrid :products="deals" />
      <div class="mt-8 text-center sm:hidden">
        <NuxtLink
          :to="{ path: localePath('/products'), query: { onSale: 'true' } }"
          class="inline-flex items-center gap-1 text-sm font-medium text-terracotta"
        >
          {{ $t('home.deals_all') }} <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// The shop's deals rail on the home page, contributed through app.config
// `homeSections` (E8d2). It owns its own data, so the project's home page
// neither fetches shop data nor names this component.
import type { Product } from '#shop/types'

const localePath = useLocalePath()
const api = useApi()

// On-sale products for the Deals rail (client-only fetch — non-blocking).
const { data: dealsData } = useAsyncData('home-deals', () =>
  api<{ products: Product[] }>(`/products?onSale=true`)
    .then((r) => r.products)
    .catch(() => [] as Product[]),
  { server: false, lazy: true },
)
const deals = computed(() => (dealsData.value ?? []).slice(0, 8))
</script>
