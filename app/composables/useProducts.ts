import type { Product } from '~/types'

const LIMIT = 12

interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  totalPages: number
}

export function useProducts(page: Ref<number>) {
  const filtersStore = useFiltersStore()
  const { public: { apiBase } } = useRuntimeConfig()

  const { data, pending, error } = useAsyncData<{ products: Product[]; total: number }>(
    'products',
    async () => {
      const params = new URLSearchParams()
      params.set('page', String(page.value))

      if (filtersStore.selectedAnimals.length)
        params.set('categories', filtersStore.selectedAnimals.join(','))
      if (filtersStore.selectedBrands.length)
        params.set('brand', filtersStore.selectedBrands[0])
      if (filtersStore.priceMin !== null)
        params.set('priceMin', String(filtersStore.priceMin))
      if (filtersStore.priceMax !== null)
        params.set('priceMax', String(filtersStore.priceMax))
      if (filtersStore.search)
        params.set('search', filtersStore.search)

      const res = await $fetch<ProductsResponse>(
        `${apiBase}/products?${params.toString()}`,
        { credentials: 'include' },
      )
      return { products: res.products, total: res.total }
    },
    {
      server: false,
      watch: [
        page,
        () => [...filtersStore.selectedAnimals],
        () => [...filtersStore.selectedBrands],
        () => filtersStore.priceMin,
        () => filtersStore.priceMax,
        () => filtersStore.search,
      ],
    },
  )

  const products = computed(() => data.value?.products ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const totalPages = computed(() => Math.ceil(total.value / LIMIT))

  return { products, pending, error, total, totalPages }
}
