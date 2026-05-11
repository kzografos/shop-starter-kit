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
              class="h-9 w-9 flex items-center justify-center rounded-lg border border-[--color-border-warm] text-[--color-bark-light] hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
            </button>

            <template v-for="p in visiblePages" :key="p">
              <span
                v-if="p === '...'"
                class="h-9 w-9 flex items-center justify-center text-sm text-[--color-bark-light]"
              >
                …
              </span>
              <button
                v-else
                class="h-9 w-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors border"
                :class="currentPage === p
                  ? 'bg-terracotta text-white border-terracotta'
                  : 'border-[--color-border-warm] text-[--color-bark] hover:border-terracotta hover:text-terracotta'"
                @click="currentPage = p as number"
              >
                {{ p }}
              </button>
            </template>

            <button
              class="h-9 w-9 flex items-center justify-center rounded-lg border border-[--color-border-warm] text-[--color-bark-light] hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
import type { Database } from '~/types/database.types'

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
  const supabase = useSupabaseClient<Database>()

  const { data: allCats } = await supabase.from('categories').select('id, slug, parent_id')

  if (!allCats) return

  const cat = allCats.find((c) => c.slug === slug)
  if (!cat) return

  // If this is a subcategory, resolve to the parent slug
  // If it's already a parent (no parent_id), use as-is
  const animalSlug = cat.parent_id
    ? (allCats.find((c) => c.id === cat.parent_id)?.slug ?? slug)
    : slug

  filtersStore.selectedAnimals = [animalSlug]
})

useSeoMeta({ title: 'Προϊόντα | PetShop CY' })
</script>
