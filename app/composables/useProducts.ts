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

  const key = computed(() =>
    `products-${JSON.stringify(filtersStore.$state)}-${page.value}`,
  )

  const { data, pending, error } = useAsyncData<{ products: Product[]; total: number }>(
    () => key.value,
    async () => {
      const params = new URLSearchParams()
      params.set('page', String(page.value))

      // Array filters → repeated params (categories=a&categories=b) so the
      // backend DTO receives a real array, not one comma-joined string.
      // queryCategories narrows a parent to its picked subcategories (Type filter).
      for (const slug of filtersStore.queryCategories)
        params.append('categories', slug)
      for (const brand of filtersStore.selectedBrands)
        params.append('brand', brand)
      // Price params must match the backend DTO field names (minPrice/maxPrice).
      if (filtersStore.priceMin !== null)
        params.set('minPrice', String(filtersStore.priceMin))
      if (filtersStore.priceMax !== null)
        params.set('maxPrice', String(filtersStore.priceMax))
      if (filtersStore.search)
        params.set('search', filtersStore.search)
      if (filtersStore.onSale)
        params.set('onSale', 'true')

      const res = await $fetch<ProductsResponse>(
        `${apiBase}/products?${params.toString()}`,
        { credentials: 'include' },
      )
      return { products: res.products, total: res.total }
    },
  )

  const products = computed(() => data.value?.products ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const totalPages = computed(() => Math.ceil(total.value / LIMIT))

  return { products, pending, error, total, totalPages }
}
