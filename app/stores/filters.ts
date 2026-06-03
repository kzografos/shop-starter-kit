import { defineStore } from 'pinia'

interface CategoryNode {
  slug: string
  children?: { slug: string }[]
}

export const useFiltersStore = defineStore('filters', () => {
  const selectedAnimals = ref<string[]>([])   // top-level (parent) category slugs
  const selectedTypes = ref<string[]>([])     // subcategory (child) slugs
  const selectedBrands = ref<string[]>([])
  const priceMin = ref<number | null>(null)
  const priceMax = ref<number | null>(null)
  const animalAge = ref<string | null>(null)
  const search = ref('')
  const onSale = ref(false)
  const tree = ref<CategoryNode[]>([])        // category tree, set by ProductFilters

  // Effective category slugs to query: a selected subcategory narrows its parent,
  // so we send the child slug instead of the parent when a type under it is picked.
  const queryCategories = computed(() => {
    const childToParent = new Map<string, string>()
    for (const p of tree.value)
      for (const c of p.children ?? []) childToParent.set(c.slug, p.slug)

    const animalsWithType = new Set(
      selectedTypes.value.map((t) => childToParent.get(t)).filter(Boolean) as string[],
    )
    const result = [...selectedTypes.value]
    for (const a of selectedAnimals.value) if (!animalsWithType.has(a)) result.push(a)
    return result
  })

  function reset() {
    selectedAnimals.value = []
    selectedTypes.value = []
    selectedBrands.value = []
    priceMin.value = null
    priceMax.value = null
    animalAge.value = null
    search.value = ''
    onSale.value = false
  }

  const hasActiveFilters = computed(() =>
    selectedAnimals.value.length > 0 ||
    selectedTypes.value.length > 0 ||
    selectedBrands.value.length > 0 ||
    priceMin.value !== null ||
    priceMax.value !== null ||
    !!animalAge.value ||
    !!search.value ||
    onSale.value
  )

  return {
    selectedAnimals,
    selectedTypes,
    selectedBrands,
    priceMin,
    priceMax,
    animalAge,
    search,
    onSale,
    tree,
    queryCategories,
    hasActiveFilters,
    reset,
  }
})
