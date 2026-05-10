<template>
  <div class="bg-cream-pale min-h-screen">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex gap-8">
      <!-- Sidebar filters (desktop) -->
      <aside class="hidden lg:block w-64 shrink-0">
        <ProductFilters />
      </aside>

      <!-- Main content -->
      <div class="flex-1 min-w-0">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 class="font-display text-3xl font-bold text-bark">{{ $t('products.title') }}</h1>
          <UInput
            v-model="filtersStore.search"
            :placeholder="$t('products.search')"
            icon="i-heroicons-magnifying-glass"
            class="w-full sm:w-64 [&_input]:rounded-full [&_input]:bg-[--color-surface-card] [&_input]:border [&_input]:border-[--color-border-warm] [&_input]:placeholder-[--color-bark-light] [&_input]:focus:border-terracotta [&_input]:text-bark [&_input]:text-sm"
            :ui="{ base: 'rounded-full' }"
          />
        </div>

        <!-- Mobile filters -->
        <div class="lg:hidden mb-4">
          <UButton
            icon="i-heroicons-adjustments-horizontal"
            :label="$t('filters.title')"
            variant="outline"
            color="neutral"
            @click="showMobileFilters = true"
          />
        </div>

        <!-- Loading -->
        <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <USkeleton v-for="n in 8" :key="n" class="aspect-3/4 rounded-2xl" />
        </div>

        <!-- Products -->
        <ProductGrid v-else-if="products && products.length > 0" :products="products" />

        <!-- No results -->
        <div v-else class="flex flex-col items-center justify-center py-20 text-center">
          <UIcon name="i-heroicons-magnifying-glass" class="w-16 h-16 text-gray-300 mb-4" />
          <p class="text-gray-500">{{ $t('products.no_results') }}</p>
          <UButton
            :label="$t('filters.reset')"
            variant="ghost"
            class="mt-4"
            @click="filtersStore.reset()"
          />
        </div>
      </div>
    </div>

  </div>

    <!-- Mobile filters slideover -->
    <USlideover v-model:open="showMobileFilters" side="left">
      <template #content>
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-semibold text-lg">{{ $t('filters.title') }}</h3>
            <UButton icon="i-heroicons-x-mark" variant="ghost" @click="showMobileFilters = false" />
          </div>
          <ProductFilters />
        </div>
      </template>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
const filtersStore = useFiltersStore()
const showMobileFilters = ref(false)
const { products, pending } = useProducts()

// Sync ?category query param to filter store (client-side nav from homepage cards)
const route = useRoute()
onMounted(() => {
  if (route.query.category) {
    const slug = route.query.category as string
    if (!filtersStore.selectedAnimals.includes(slug)) {
      filtersStore.selectedAnimals = [slug, ...filtersStore.selectedAnimals]
    }
  }
})

useSeoMeta({ title: 'Προϊόντα | PetShop CY' })
</script>
