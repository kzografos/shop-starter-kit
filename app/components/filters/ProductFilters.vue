<template>
  <div class="bg-cream rounded-2xl p-6 space-y-7">

    <!-- Animal -->
    <div>
      <h3 class="font-semibold text-bark mb-4">{{ $t('filters.animal') }}</h3>
      <div class="space-y-3">
        <label
          v-for="animal in animals"
          :key="animal.slug"
          class="flex items-center justify-between cursor-pointer group"
          @click.prevent="toggleAnimal(animal.slug)"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-150"
              :class="localAnimals.includes(animal.slug)
                ? 'bg-terracotta border-terracotta'
                : 'border-gray-300 group-hover:border-terracotta/50'"
            >
              <svg v-if="localAnimals.includes(animal.slug)" class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{{ animal.name }}</span>
          </div>
          <span class="text-xs text-gray-400 font-medium">{{ animal.count }}</span>
        </label>
      </div>
    </div>

    <div class="h-px bg-gray-100" />

    <!-- Price range -->
    <div>
      <h3 class="font-semibold text-bark mb-4">
        {{ $t('filters.price') }} · €
      </h3>
      <div class="relative mb-6">
        <!-- Track -->
        <div class="relative h-1.5 bg-gray-200 rounded-full mx-2.5">
          <div
            class="absolute h-1.5 bg-terracotta rounded-full"
            :style="{
              left: `${((localPriceMin - PRICE_ABS_MIN) / (PRICE_ABS_MAX - PRICE_ABS_MIN)) * 100}%`,
              right: `${100 - ((localPriceMax - PRICE_ABS_MIN) / (PRICE_ABS_MAX - PRICE_ABS_MIN)) * 100}%`,
            }"
          />
          <!-- Visual min thumb -->
          <div
            class="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-terracotta shadow-md pointer-events-none -translate-x-1/2"
            :style="{ left: `${((localPriceMin - PRICE_ABS_MIN) / (PRICE_ABS_MAX - PRICE_ABS_MIN)) * 100}%` }"
          />
          <!-- Visual max thumb -->
          <div
            class="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-terracotta shadow-md pointer-events-none -translate-x-1/2"
            :style="{ left: `${((localPriceMax - PRICE_ABS_MIN) / (PRICE_ABS_MAX - PRICE_ABS_MIN)) * 100}%` }"
          />
        </div>
        <!-- Min thumb (invisible, handles drag) -->
        <input
          v-model.number="localPriceMin"
          type="range"
          :min="PRICE_ABS_MIN"
          :max="PRICE_ABS_MAX"
          step="1"
          class="range-thumb"
          @input="localPriceMin = Math.min(localPriceMin, localPriceMax - 1)"
        >
        <!-- Max thumb (invisible, handles drag) -->
        <input
          v-model.number="localPriceMax"
          type="range"
          :min="PRICE_ABS_MIN"
          :max="PRICE_ABS_MAX"
          step="1"
          class="range-thumb"
          @input="localPriceMax = Math.max(localPriceMax, localPriceMin + 1)"
        >
      </div>
      <div class="flex justify-between text-sm font-medium text-gray-600">
        <span>€{{ localPriceMin }}</span>
        <span>€{{ localPriceMax }}</span>
      </div>
    </div>

    <div class="h-px bg-gray-100" />

    <!-- Brand -->
    <div>
      <h3 class="font-semibold text-bark mb-4">{{ $t('filters.brand') }}</h3>
      <div class="space-y-3">
        <label
          v-for="brand in brands"
          :key="brand.name"
          class="flex items-center justify-between cursor-pointer group"
          @click.prevent="toggleBrand(brand.name)"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-150"
              :class="localBrands.includes(brand.name)
                ? 'bg-terracotta border-terracotta'
                : 'border-gray-300 group-hover:border-terracotta/50'"
            >
              <svg v-if="localBrands.includes(brand.name)" class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{{ brand.name }}</span>
          </div>
          <span class="text-xs text-gray-400 font-medium">{{ brand.count }}</span>
        </label>
      </div>
    </div>

    <!-- Apply button -->
    <button
      class="w-full py-4 rounded-2xl font-semibold text-white text-sm tracking-wide bg-terracotta hover:bg-terracotta-dark transition-colors active:opacity-80"
      @click="applyFilters"
    >
      ✓ {{ $t('filters.apply') }}
    </button>

    <!-- Reset -->
    <button
      v-if="filtersStore.hasActiveFilters"
      class="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
      @click="resetAll"
    >
      {{ $t('filters.reset') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Database } from '~/types/database.types'

type CategoryRow = Database['public']['Tables']['categories']['Row']
type ProductRow = Database['public']['Tables']['products']['Row']
const filtersStore = useFiltersStore()
const { locale } = useI18n()
const supabase = useSupabaseClient()

const PRICE_ABS_MIN = 0
const PRICE_ABS_MAX = 500

// Local staged state — only committed on Apply
const localAnimals = ref<string[]>([...filtersStore.selectedAnimals])
const localBrands = ref<string[]>([...filtersStore.selectedBrands])
const localPriceMin = ref<number>(filtersStore.priceMin ?? PRICE_ABS_MIN)
const localPriceMax = ref<number>(filtersStore.priceMax ?? PRICE_ABS_MAX)

const animals = ref<Array<{ slug: string; name: string; count: number }>>([])
const brands = ref<Array<{ name: string; count: number }>>([])

function toggleAnimal(slug: string) {
  const idx = localAnimals.value.indexOf(slug)
  if (idx === -1) localAnimals.value.push(slug)
  else localAnimals.value.splice(idx, 1)
}

function toggleBrand(name: string) {
  const idx = localBrands.value.indexOf(name)
  if (idx === -1) localBrands.value.push(name)
  else localBrands.value.splice(idx, 1)
}

function applyFilters() {
  filtersStore.selectedAnimals = [...localAnimals.value]
  filtersStore.selectedBrands = [...localBrands.value]
  filtersStore.priceMin = localPriceMin.value > PRICE_ABS_MIN ? localPriceMin.value : null
  filtersStore.priceMax = localPriceMax.value < PRICE_ABS_MAX ? localPriceMax.value : null
}

function resetAll() {
  localAnimals.value = []
  localBrands.value = []
  localPriceMin.value = PRICE_ABS_MIN
  localPriceMax.value = PRICE_ABS_MAX
  filtersStore.reset()
}

onMounted(async () => {
  // Fetch products with category info for counts
  const { data: products } = await supabase
    .from('products')
    .select('brand, category:categories!inner(slug, parent:categories(slug))')
    .eq('is_active', true)

  if (!products) return

  // Build brand counts
  const brandMap = new Map<string, number>()
  products.forEach((p: { brand: string | null }) => {
    if (p.brand) brandMap.set(p.brand, (brandMap.get(p.brand) ?? 0) + 1)
  })
  brands.value = [...brandMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  // Fetch top-level categories with counts
  const { data: cats } = await supabase
    .from('categories')
    .select('id, slug, name_el, name_en')
    .is('parent_id', null)
    .order('sort_order')

  if (!cats) return

  // Count products per top-level category (via sub-categories)
  const { data: subCats } = await supabase
    .from('categories')
    .select('id, parent_id')
    .not('parent_id', 'is', null)

  const { data: productCats } = await supabase
    .from('products')
    .select('category_id')
    .eq('is_active', true)

  const subCatToParent = new Map((subCats ?? []).map((s: Pick<CategoryRow, 'id' | 'parent_id'>) => [s.id, s.parent_id]))
  const parentCounts = new Map<string, number>()

  ;(productCats ?? []).forEach((p: Pick<ProductRow, 'category_id'>) => {
    const parentId = subCatToParent.get(p.category_id) ?? p.category_id
    parentCounts.set(parentId, (parentCounts.get(parentId) ?? 0) + 1)
  })

  animals.value = cats.map((c: Pick<CategoryRow, 'id' | 'slug' | 'name_el' | 'name_en'>) => ({
    slug: c.slug,
    name: locale.value === 'el' ? c.name_el : c.name_en,
    count: parentCounts.get(c.id) ?? 0,
  }))
})
</script>

<style scoped>
.range-thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  pointer-events: none;
}

.range-thumb::-webkit-slider-thumb {
  pointer-events: all;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid #C97B5A;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  cursor: grab;
  -webkit-appearance: none;
}

.range-thumb::-moz-range-thumb {
  pointer-events: all;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 2px solid #C97B5A;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  cursor: grab;
}
</style>
