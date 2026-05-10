<template>
  <div>
    <!-- Hero -->
    <section class="bg-cream-pale border-b border-[--color-border-soft] py-14 px-4">
      <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
        <p class="text-terracotta text-xs font-semibold tracking-widest uppercase mb-3">{{ $t('brands.eyebrow') }}</p>
        <h1 class="font-display text-4xl sm:text-5xl font-bold text-bark mb-3">{{ $t('brands.title') }}</h1>
        <p class="text-bark-light max-w-xl">{{ $t('brands.subtitle') }}</p>
        <p v-if="brands?.length" class="mt-4 text-sm text-bark-light">
          <span class="font-semibold text-bark">{{ brands.length }}</span> {{ $t('brands.available') }}
        </p>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="pending" class="bg-cream-pale min-h-screen">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div class="grid sm:grid-cols-3 gap-5">
          <USkeleton v-for="n in 3" :key="n" class="h-36 rounded-2xl" />
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <USkeleton v-for="n in 8" :key="n" class="h-24 rounded-2xl" />
        </div>
      </div>
    </div>

    <div v-else-if="brands?.length" class="bg-cream-pale min-h-screen">
      <!-- Featured brands (top 3) -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <div class="grid sm:grid-cols-3 gap-5">
          <button
            v-for="brand in featuredBrands"
            :key="brand.name"
            class="group relative bg-white rounded-2xl p-10 shadow-sm overflow-hidden text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            @click="goToBrand(brand.name)"
          >
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-terracotta scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            <p class="font-display text-2xl font-bold text-bark group-hover:text-terracotta transition-colors duration-300 leading-tight">
              {{ brand.name }}
            </p>
            <p class="text-bark-light text-sm mt-2">{{ brand.count }} {{ $t('brands.products') }}</p>
            <UIcon name="i-heroicons-arrow-right" class="absolute top-8 right-8 w-4 h-4 text-bark-light/30 group-hover:text-terracotta/60 group-hover:translate-x-0.5 transition-all duration-300" />
          </button>
        </div>
      </section>

      <!-- Regular brands -->
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <button
            v-for="brand in regularBrands"
            :key="brand.name"
            class="group relative bg-white rounded-2xl p-6 shadow-sm overflow-hidden text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
            @click="goToBrand(brand.name)"
          >
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-terracotta scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            <p class="font-display text-lg font-bold text-bark group-hover:text-terracotta transition-colors duration-300 leading-tight">
              {{ brand.name }}
            </p>
            <p class="text-bark-light text-xs mt-1">{{ brand.count }} {{ $t('brands.products') }}</p>
          </button>
        </div>
      </section>
    </div>

    <p v-else-if="!pending" class="text-center text-bark-light py-24">
      {{ $t('brands.empty') }}
    </p>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const localePath = useLocalePath()
const filtersStore = useFiltersStore()
const router = useRouter()

const { data: brands, pending } = useAsyncData('brands-page', async () => {
  const { data } = await supabase
    .from('products')
    .select('brand')
    .eq('is_active', true)
    .not('brand', 'is', null)

  const brandMap = new Map<string, number>()
  for (const p of data ?? []) {
    if (p.brand) brandMap.set(p.brand, (brandMap.get(p.brand) ?? 0) + 1)
  }

  return Array.from(brandMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

const featuredBrands = computed(() => brands.value?.slice(0, 3) ?? [])
const regularBrands = computed(() => brands.value?.slice(3) ?? [])

function goToBrand(brandName: string) {
  filtersStore.reset()
  filtersStore.selectedBrands = [brandName]
  router.push(localePath('/products'))
}

useSeoMeta({
  title: 'Brands — PetShop CY',
  description: 'Browse all pet food and accessory brands available at PetShop CY.',
})
</script>
