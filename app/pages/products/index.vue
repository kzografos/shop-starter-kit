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
              v-model="searchQuery"
              :placeholder="$t('products.search')"
              icon="i-heroicons-magnifying-glass"
              class="w-auto [&_input]:rounded-full [&_input]:bg-surface-card [&_input]:border [&_input]:border-[--color-border-warm] [&_input]:placeholder-[--color-bark-light] [&_input]:focus:border-terracotta [&_input]:text-bark [&_input]:text-sm"
              :ui="{ base: 'rounded-full' }"
            />
          </div>

          <!-- Mobile filters -->
          <div class="lg:hidden mb-4">
            <button
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-cream border border-[--color-border-warm] text-sm font-medium text-bark hover:border-terracotta hover:text-terracotta transition-colors"
              @click="showMobileFilters = true"
            >
              <UIcon name="i-heroicons-adjustments-horizontal" class="w-4 h-4" />
              {{ $t('filters.title') }}
            </button>
          </div>

          <!-- Loading -->
          <div v-if="pending" class="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            <USkeleton v-for="n in 8" :key="n" class="aspect-3/4 rounded-2xl" />
          </div>

          <!-- Products -->
          <ProductGrid v-else-if="products && products.length > 0" :products="products" />

          <!-- No results -->
          <div v-else class="flex flex-col items-center justify-center py-20 text-center">
            <UIcon name="i-heroicons-magnifying-glass" class="w-16 h-16 text-[--color-bark-light] mb-4" />
            <p class="text-[--color-bark-light]">{{ $t('products.no_results') }}</p>
            <button
              class="mt-4 text-sm text-terracotta hover:text-terracotta-dark transition-colors"
              @click="filtersStore.reset()"
            >
              {{ $t('filters.reset') }}
            </button>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex items-center justify-center gap-1 mt-10">
            <button
              class="h-11 w-11 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg border border-[--color-border-warm] text-[--color-bark-light] hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
            </button>

            <template v-for="p in visiblePages" :key="p">
              <span
                v-if="p === '...'"
                class="h-11 w-11 sm:h-9 sm:w-9 flex items-center justify-center text-sm text-[--color-bark-light]"
              >
                …
              </span>
              <button
                v-else
                class="h-11 w-11 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors border"
                :class="currentPage === p
                  ? 'bg-terracotta text-white border-terracotta'
                  : 'border-[--color-border-warm] text-[--color-bark] hover:border-terracotta hover:text-terracotta'"
                @click="currentPage = p as number"
              >
                {{ p }}
              </button>
            </template>

            <button
              class="h-11 w-11 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg border border-[--color-border-warm] text-[--color-bark-light] hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile filters slideover -->
    <USlideover v-model:open="showMobileFilters" side="left" :ui="{ content: '!bg-cream' }">
      <template #content>
        <div class="flex flex-col h-full bg-cream">
          <!-- Fixed header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-[--color-border-warm] bg-cream shrink-0">
            <h3 class="font-display font-bold text-lg text-bark">{{ $t('filters.title') }}</h3>
            <button
              class="h-9 w-9 flex items-center justify-center rounded-full text-bark-light hover:bg-cream-pale transition-colors"
              @click="showMobileFilters = false"
            >
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>
          <!-- Scrollable body -->
          <div class="flex-1 overflow-y-auto p-4">
            <ProductFilters @applied="showMobileFilters = false" />
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>

<script setup lang="ts">

const { t } = useI18n()
const filtersStore = useFiltersStore()
const showMobileFilters = ref(false)

// Local ref for search input — decoupled from the store
const searchQuery = ref(filtersStore.search ?? '')

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filtersStore.search = value
  }, 600)
})

const route = useRoute()
const router = useRouter()

// Page state — synced to URL ?page=
const currentPage = ref(Number(route.query.page) || 1)

// Reset to page 1 when filters change
watch(
  [
    () => filtersStore.selectedAnimals,
    () => filtersStore.selectedBrands,
    () => filtersStore.priceMin,
    () => filtersStore.priceMax,
    () => filtersStore.search,
  ],
  () => { currentPage.value = 1 },
  { deep: true }
)

// Sync page to URL + scroll to top
watch(currentPage, (page) => {
  const query = { ...route.query }
  if (page === 1) delete query.page
  else query.page = String(page)
  router.replace({ query })
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

const { products, pending, totalPages } = useProducts(currentPage)

// Sync filter store back to URL so clearing filters also clears the query param
watch(
  () => [...filtersStore.selectedAnimals],
  (animals) => {
    const query = { ...route.query }
    if (animals.length === 0) {
      delete query.category
    } else if (animals.length === 1) {
      query.category = animals[0] as string
    } else {
      // Multiple animals selected via sidebar — remove single-category param
      delete query.category
    }
    router.replace({ query })
  }
)

// Computed page numbers with ellipsis
const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++)
    pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

// Sync ?category query param to filter store (client-side nav from homepage cards)
onMounted(async () => {
  if (!route.query.category) return
  const slug = route.query.category as string
  const { public: { apiBase } } = useRuntimeConfig()
  type CatEntry = { id: string; slug: string; parent_id: string | null }
  const allCats = await $fetch<Array<{ id: string; slug: string; children: CatEntry[] }>>(
    `${apiBase}/categories`,
    { credentials: 'include' },
  ).catch(() => [])

  // Flatten to find slug in all cats (parents + children)
  const flat: CatEntry[] = []
  for (const parent of allCats) {
    flat.push({ id: parent.id, slug: parent.slug, parent_id: null })
    for (const child of parent.children ?? []) flat.push(child)
  }

  const cat = flat.find((c) => c.slug === slug)
  if (!cat) return

  const animalSlug = cat.parent_id
    ? (flat.find((c) => c.id === cat.parent_id)?.slug ?? slug)
    : slug

  filtersStore.selectedAnimals = [animalSlug]
})

useSeoMeta({ title: () => t('products.title') })
</script>
