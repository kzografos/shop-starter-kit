<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center gap-3 mb-8">
      <NuxtLink :to="localePath('/account')" class="text-bark-light hover:text-bark transition-colors">
        <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
      </NuxtLink>
      <h1 class="font-display text-3xl font-bold text-bark">{{ $t('favourites.title') }}</h1>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <USkeleton v-for="n in 6" :key="n" class="aspect-3/4 rounded-2xl" />
    </div>

    <!-- Products -->
    <ProductGrid v-else-if="products && products.length > 0" :products="products" />

    <!-- Empty -->
    <div v-else class="flex flex-col items-center justify-center py-24 text-center">
      <UIcon name="i-heroicons-heart" class="w-16 h-16 text-cream-pale mb-4" />
      <p class="text-bark-light max-w-sm">{{ $t('favourites.empty') }}</p>
      <NuxtLink
        :to="localePath('/products')"
        class="mt-6 px-6 py-2.5 rounded-full bg-terracotta text-white text-sm font-semibold hover:bg-terracotta-dark transition-colors"
      >
        {{ $t('nav.products') }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const localePath = useLocalePath()
const supabase = useSupabaseClient()
const favouritesStore = useFavouritesStore()

const { data: products, pending } = await useAsyncData('favourites', async () => {
  if (!favouritesStore.ids.length) return []
  const { data } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .in('id', favouritesStore.ids)
    .eq('is_active', true)
  return data ?? []
}, { watch: [() => favouritesStore.ids.length] })

useSeoMeta({ title: 'Αγαπημένα | PetShop CY' })
</script>
