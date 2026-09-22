<template>
  <div class="bg-surface-page min-h-screen">
    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 max-w-6xl mx-auto px-4 py-10">
      <AccountSidebar />

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

        <!-- Error -->
        <div v-else-if="error" class="text-center py-12 text-danger">
          {{ error }}
        </div>

        <!-- Products -->
        <ShopProductGrid v-else-if="products && products.length > 0" :products="products" />

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
import type { Product } from '#shop/types'

definePageMeta({ middleware: 'auth' })

const api = useApi()
const localePath = useLocalePath()
const { t } = useI18n()

const error = ref<string | null>(null)

const { data: products, pending } = useAsyncData('favourites', async () => {
  const favs = await api<Array<{ product: Product }>>('/favourites').catch(() => {
    error.value = 'Failed to load. Please try again.'
    return [] as Array<{ product: Product }>
  })
  return favs.map((f) => f.product)
}, { server: false, lazy: true })

useSeoMeta({ title: () => t('favourites.title') })
</script>
