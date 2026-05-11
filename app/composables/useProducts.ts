import type { Product } from '~/types'
import type { Database } from '~/types/database.types'

type CategoryRow = Database['public']['Tables']['categories']['Row']

const LIMIT = 12

export function useProducts(page: Ref<number>) {
  const supabase = useSupabaseClient<Database>()
  const filtersStore = useFiltersStore()

  const { data, pending, error } = useAsyncData<{ products: Product[]; total: number }>(
    'products',
    async () => {
      const from = (page.value - 1) * LIMIT
      const to = from + LIMIT - 1

      let query = supabase
        .from('products')
        .select('*, category:categories(*)', { count: 'exact' })
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filtersStore.selectedAnimals.length > 0) {
        const { data: parentCats } = await supabase
          .from('categories')
          .select('id')
          .in('slug', filtersStore.selectedAnimals)

        if (parentCats && parentCats.length > 0) {
          const parentIds = parentCats.map((c: Pick<CategoryRow, 'id'>) => c.id)
          const { data: subCats } = await supabase
            .from('categories')
            .select('id')
            .in('parent_id', parentIds)
          const allCatIds = [
            ...parentIds,
            ...(subCats ?? []).map((c: Pick<CategoryRow, 'id'>) => c.id),
          ]
          query = query.in('category_id', allCatIds)
        }
      }

      if (filtersStore.selectedBrands.length > 0)
        query = query.in('brand', filtersStore.selectedBrands)
      if (filtersStore.priceMin !== null)
        query = query.gte('price', filtersStore.priceMin)
      if (filtersStore.priceMax !== null)
        query = query.lte('price', filtersStore.priceMax)
      if (filtersStore.search)
        query = query.or(
          `name_el.ilike.%${filtersStore.search}%,name_en.ilike.%${filtersStore.search}%`
        )

      const { data, count, error } = await query
      if (error) throw error
      return { products: (data ?? []) as Product[], total: count ?? 0 }
    },
    {
      watch: [
        page,
        () => [...filtersStore.selectedAnimals],
        () => [...filtersStore.selectedBrands],
        () => filtersStore.priceMin,
        () => filtersStore.priceMax,
        () => filtersStore.search,
      ],
    }
  )

  const products = computed(() => data.value?.products ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const totalPages = computed(() => Math.ceil(total.value / LIMIT))

  return { products, pending, error, total, totalPages }
}
