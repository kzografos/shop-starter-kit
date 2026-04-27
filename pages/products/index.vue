<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex gap-8">
      <!-- Sidebar filters (desktop) -->
      <aside class="hidden lg:block w-56 flex-shrink-0">
        <ProductFilters />
      </aside>

      <!-- Main content -->
      <div class="flex-1 min-w-0">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 class="text-2xl font-bold text-gray-900">{{ $t('products.title') }}</h1>
          <UInput
            v-model="filtersStore.search"
            :placeholder="$t('products.search')"
            icon="i-heroicons-magnifying-glass"
            class="w-full sm:w-64"
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
        <div v-if="pending" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <USkeleton v-for="n in 8" :key="n" class="aspect-[3/4] rounded-2xl" />
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
const supabase = useSupabaseClient()
const showMobileFilters = ref(false)

const { data: products, pending } = await useAsyncData('products', async () => {
  let query = supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (filtersStore.selectedAnimals.length > 0) {
    const { data: parentCats } = await supabase
      .from('categories')
      .select('id')
      .in('slug', filtersStore.selectedAnimals)

    if (parentCats && parentCats.length > 0) {
      const parentIds = parentCats.map((c: any) => c.id)
      const { data: subCats } = await supabase
        .from('categories')
        .select('id')
        .in('parent_id', parentIds)

      const allCatIds = [...parentIds, ...(subCats ?? []).map((c: any) => c.id)]
      query = query.in('category_id', allCatIds)
    }
  }

  if (filtersStore.selectedBrands.length > 0) {
    query = query.in('brand', filtersStore.selectedBrands)
  }

  if (filtersStore.priceMin !== null) {
    query = query.gte('price', filtersStore.priceMin)
  }

  if (filtersStore.priceMax !== null) {
    query = query.lte('price', filtersStore.priceMax)
  }

  if (filtersStore.search) {
    query = query.or(`name_el.ilike.%${filtersStore.search}%,name_en.ilike.%${filtersStore.search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}, {
  watch: [
    () => [...filtersStore.selectedAnimals],
    () => [...filtersStore.selectedBrands],
    () => filtersStore.priceMin,
    () => filtersStore.priceMax,
    () => filtersStore.search,
  ],
})

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
