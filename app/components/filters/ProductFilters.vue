<template>
  <div class="bg-cream rounded-2xl p-6 space-y-7">
    <!-- Offers / Deals -->
    <label
      class="flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2.5 transition-colors"
      :class="localOnSale ? 'bg-warm-red/15' : 'bg-warm-red/8 hover:bg-warm-red/15'"
      @click.prevent="localOnSale = !localOnSale"
    >
      <div
        class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-150"
        :class="localOnSale ? 'bg-warm-red border-warm-red' : 'border-warm-red/60'"
      >
        <svg v-if="localOnSale" class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <span class="text-sm font-bold uppercase tracking-wide text-warm-red">
        {{ $t('filters.on_sale') }}
      </span>
    </label>

    <div class="h-px bg-gray-100" />

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
              :class="
                localAnimals.includes(animal.slug)
                  ? 'bg-terracotta border-terracotta'
                  : 'border-gray-300 group-hover:border-terracotta/50'
              "
            >
              <svg
                v-if="localAnimals.includes(animal.slug)"
                class="w-3 h-3 text-white"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <span class="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{{
              animal.name
            }}</span>
          </div>
        </label>
      </div>
    </div>

    <!-- Type (subcategories of selected animals) -->
    <template v-if="availableTypes.length">
      <div class="h-px bg-gray-100" />
      <div>
        <h3 class="font-semibold text-bark mb-4">{{ $t('filters.type') }}</h3>
        <div class="space-y-3">
          <label
            v-for="type in availableTypes"
            :key="type.slug"
            class="flex items-center cursor-pointer group"
            @click.prevent="toggleType(type.slug)"
          >
            <div
              class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-150"
              :class="
                localTypes.includes(type.slug)
                  ? 'bg-terracotta border-terracotta'
                  : 'border-gray-300 group-hover:border-terracotta/50'
              "
            >
              <svg
                v-if="localTypes.includes(type.slug)"
                class="w-3 h-3 text-white"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <span class="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{{
              type.name
            }}</span>
          </label>
        </div>
      </div>
    </template>

    <div class="h-px bg-gray-100" />

    <!-- Price range -->
    <div>
      <h3 class="font-semibold text-bark mb-4">{{ $t('filters.price') }} · €</h3>
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
            :style="{
              left: `${((localPriceMin - PRICE_ABS_MIN) / (PRICE_ABS_MAX - PRICE_ABS_MIN)) * 100}%`,
            }"
          />
          <!-- Visual max thumb -->
          <div
            class="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-terracotta shadow-md pointer-events-none -translate-x-1/2"
            :style="{
              left: `${((localPriceMax - PRICE_ABS_MIN) / (PRICE_ABS_MAX - PRICE_ABS_MIN)) * 100}%`,
            }"
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
        />
        <!-- Max thumb (invisible, handles drag) -->
        <input
          v-model.number="localPriceMax"
          type="range"
          :min="PRICE_ABS_MIN"
          :max="PRICE_ABS_MAX"
          step="1"
          class="range-thumb"
          @input="localPriceMax = Math.max(localPriceMax, localPriceMin + 1)"
        />
      </div>
      <div class="flex items-center gap-2 mt-2">
        <div class="relative flex-1">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
          <input
            v-model.number="localPriceMin"
            type="number"
            min="0"
            :max="localPriceMax - 1"
            class="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-terracotta text-gray-700"
            @blur="localPriceMin = Math.min(Math.max(0, localPriceMin), localPriceMax - 1)"
          />
        </div>
        <span class="text-xs text-gray-400 shrink-0">—</span>
        <div class="relative flex-1">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
          <input
            v-model.number="localPriceMax"
            type="number"
            :min="localPriceMin + 1"
            :max="PRICE_ABS_MAX"
            class="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-terracotta text-gray-700"
            @blur="
              localPriceMax = Math.max(Math.min(PRICE_ABS_MAX, localPriceMax), localPriceMin + 1)
            "
          />
        </div>
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
              :class="
                localBrands.includes(brand.name)
                  ? 'bg-terracotta border-terracotta'
                  : 'border-gray-300 group-hover:border-terracotta/50'
              "
            >
              <svg
                v-if="localBrands.includes(brand.name)"
                class="w-3 h-3 text-white"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <span class="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{{
              brand.name
            }}</span>
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
const emit = defineEmits<{ applied: [] }>()

const filtersStore = useFiltersStore()
const { locale } = useI18n()
const {
  public: { apiBase },
} = useRuntimeConfig()

const PRICE_ABS_MIN = 0
const PRICE_ABS_MAX = 500

interface TypeNode {
  slug: string
  name: string
}
interface AnimalNode {
  slug: string
  name: string
  children: TypeNode[]
}

// Local staged state — only committed on Apply
const localOnSale = ref<boolean>(filtersStore.onSale)
const localAnimals = ref<string[]>([...filtersStore.selectedAnimals])
const localTypes = ref<string[]>([...filtersStore.selectedTypes])
const localBrands = ref<string[]>([...filtersStore.selectedBrands])
const localPriceMin = ref<number>(filtersStore.priceMin ?? PRICE_ABS_MIN)
const localPriceMax = ref<number>(filtersStore.priceMax ?? PRICE_ABS_MAX)

const animals = ref<AnimalNode[]>([])
const brands = ref<Array<{ name: string; count: number }>>([])

// Subcategories ("Type") for the currently selected animals.
const availableTypes = computed<TypeNode[]>(() =>
  animals.value.filter((a) => localAnimals.value.includes(a.slug)).flatMap((a) => a.children)
)

// Sync local state when store is updated from outside (e.g. URL-based init)
watch(
  () => filtersStore.onSale,
  (v) => {
    localOnSale.value = v
  }
)
watch(
  () => filtersStore.selectedAnimals,
  (v) => {
    localAnimals.value = [...v]
  }
)
watch(
  () => filtersStore.selectedTypes,
  (v) => {
    localTypes.value = [...v]
  }
)
watch(
  () => filtersStore.selectedBrands,
  (v) => {
    localBrands.value = [...v]
  }
)

function toggleAnimal(slug: string) {
  const idx = localAnimals.value.indexOf(slug)
  if (idx === -1) {
    localAnimals.value.push(slug)
  } else {
    localAnimals.value.splice(idx, 1)
    // Drop any selected types belonging to the deselected animal.
    const childSlugs = animals.value.find((a) => a.slug === slug)?.children.map((c) => c.slug) ?? []
    localTypes.value = localTypes.value.filter((t) => !childSlugs.includes(t))
  }
}

function toggleType(slug: string) {
  const idx = localTypes.value.indexOf(slug)
  if (idx === -1) localTypes.value.push(slug)
  else localTypes.value.splice(idx, 1)
}

function toggleBrand(name: string) {
  const idx = localBrands.value.indexOf(name)
  if (idx === -1) localBrands.value.push(name)
  else localBrands.value.splice(idx, 1)
}

function applyFilters() {
  filtersStore.onSale = localOnSale.value
  filtersStore.selectedAnimals = [...localAnimals.value]
  filtersStore.selectedTypes = [...localTypes.value]
  filtersStore.selectedBrands = [...localBrands.value]
  filtersStore.priceMin = localPriceMin.value > PRICE_ABS_MIN ? localPriceMin.value : null
  filtersStore.priceMax = localPriceMax.value < PRICE_ABS_MAX ? localPriceMax.value : null
  emit('applied')
}

function resetAll() {
  localOnSale.value = false
  localAnimals.value = []
  localTypes.value = []
  localBrands.value = []
  localPriceMin.value = PRICE_ABS_MIN
  localPriceMax.value = PRICE_ABS_MAX
  filtersStore.reset()
}

onMounted(async () => {
  type BrandRow = { brand: string; count: number }
  type CatChild = { slug: string; name_el: string; name_en: string }
  type CatTree = { slug: string; name_el: string; name_en: string; children: CatChild[] }

  const [brandData, catTree] = await Promise.all([
    $fetch<BrandRow[]>(`${apiBase}/products/brands`, { credentials: 'include' }).catch(() => []),
    $fetch<CatTree[]>(`${apiBase}/categories`, { credentials: 'include' }).catch(() => []),
  ])

  brands.value = brandData.map((r) => ({ name: r.brand, count: r.count }))

  const name = (el: string, en: string) => (locale.value === 'el' ? el : en)
  animals.value = catTree.map((c) => ({
    slug: c.slug,
    name: name(c.name_el, c.name_en),
    children: (c.children ?? []).map((ch) => ({
      slug: ch.slug,
      name: name(ch.name_el, ch.name_en),
    })),
  }))

  // Share the tree with the store so it can compute effective query categories.
  filtersStore.tree = catTree.map((c) => ({
    slug: c.slug,
    children: (c.children ?? []).map((ch) => ({ slug: ch.slug })),
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
  border: 2px solid #c97b5a;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  cursor: grab;
  -webkit-appearance: none;
}

.range-thumb::-moz-range-thumb {
  pointer-events: all;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 2px solid #c97b5a;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  cursor: grab;
}
</style>
