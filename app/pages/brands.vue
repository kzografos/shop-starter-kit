<template>
  <div>
    <!-- Hero -->
    <section class="bg-cream-pale border-b border-cream-pale py-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p class="text-bark-light text-xs font-semibold tracking-widest uppercase mb-2">{{ $t('brands.eyebrow') }}</p>
        <h1 class="font-display text-4xl font-bold text-bark">{{ $t('brands.title') }}</h1>
        <p class="text-bark-light mt-2 max-w-xl">{{ $t('brands.subtitle') }}</p>
      </div>
    </section>

    <!-- Brand grid -->
    <section class="bg-cream min-h-screen">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div v-if="pending" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <USkeleton v-for="n in 12" :key="n" class="h-32 rounded-2xl" />
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <button
            v-for="brand in brands"
            :key="brand.name"
            class="group flex flex-col items-center justify-center gap-3 p-6 bg-cream rounded-2xl border border-cream-pale hover:border-terracotta/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 text-center"
            @click="goToBrand(brand.name)"
          >
            <div class="w-12 h-12 rounded-xl bg-cream-pale flex items-center justify-center group-hover:bg-terracotta/10 transition-colors">
              <UIcon :name="brandIcon(brand.name)" class="w-6 h-6 text-bark-light group-hover:text-terracotta transition-colors" />
            </div>
            <div>
              <p class="font-semibold text-bark text-sm group-hover:text-terracotta transition-colors leading-snug">
                {{ brand.name }}
              </p>
              <p class="text-bark-light text-xs mt-0.5">{{ brand.count }} {{ $t('brands.products') }}</p>
            </div>
          </button>
        </div>

        <p v-if="!pending && !brands?.length" class="text-center text-bark-light py-20">
          {{ $t('brands.empty') }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const localePath = useLocalePath()
const filtersStore = useFiltersStore()
const router = useRouter()

const brandIcons: Record<string, string> = {
  'Royal Canin': 'i-heroicons-star',
  'Purina Pro Plan': 'i-heroicons-heart',
  'Pedigree': 'i-heroicons-sparkles',
  'Whiskas': 'i-heroicons-moon',
  'Dreamies': 'i-heroicons-gift',
  'Trixie': 'i-heroicons-bolt',
  'Kong': 'i-heroicons-shield-check',
  'Versele-Laga': 'i-heroicons-sun',
  'Vitakraft': 'i-heroicons-beaker',
  "Hill's Science Diet": 'i-heroicons-academic-cap',
  'Eukanuba': 'i-heroicons-trophy',
  'Orijen': 'i-heroicons-fire',
}

function brandIcon(name: string) {
  return brandIcons[name] ?? 'i-heroicons-tag'
}

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
