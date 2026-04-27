import { defineStore } from 'pinia'

export const useFiltersStore = defineStore('filters', () => {
  const selectedAnimals = ref<string[]>([])   // top-level category slugs
  const selectedBrands = ref<string[]>([])
  const priceMin = ref<number | null>(null)
  const priceMax = ref<number | null>(null)
  const animalAge = ref<string | null>(null)
  const search = ref('')

  function reset() {
    selectedAnimals.value = []
    selectedBrands.value = []
    priceMin.value = null
    priceMax.value = null
    animalAge.value = null
    search.value = ''
  }

  const hasActiveFilters = computed(() =>
    selectedAnimals.value.length > 0 ||
    selectedBrands.value.length > 0 ||
    priceMin.value !== null ||
    priceMax.value !== null ||
    !!animalAge.value ||
    !!search.value
  )

  return {
    selectedAnimals,
    selectedBrands,
    priceMin,
    priceMax,
    animalAge,
    search,
    hasActiveFilters,
    reset,
  }
})
