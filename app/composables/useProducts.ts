// Product fetching and filtering logic
import type { Product } from '~/types'
import type { Database } from '~/types/database.types'

type CategoryRow = Database['public']['Tables']['categories']['Row']

export function useProducts() {
  const supabase = useSupabaseClient<Database>()
  const filtersStore = useFiltersStore()

  const { data: products, pending, error } = useAsyncData<Product[]>('products', async () => {
    let query = supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

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

        const allCatIds = [...parentIds, ...(subCats ?? []).map((c: Pick<CategoryRow, 'id'>) => c.id)]
        query = query.in('category_id', allCatIds)
      }
    }

    if (filtersStore.selectedBrands.length > 0) {
      query = query.in('brand', filtersStore.selectedBrands)
    }

    if (filtersStore.priceMin !== null) {
      query = query.gte('price', filtersStore.priceMin)
    }

    if (filtersStore.priceMax !== null) {
      query = query.lte('price', filtersStore.priceMax)
    }

    if (filtersStore.search) {
      query = query.or(
        `name_el.ilike.%${filtersStore.search}%,name_en.ilike.%${filtersStore.search}%`
      )
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as Product[]
  }, {
    watch: [
      () => [...filtersStore.selectedAnimals],
      () => [...filtersStore.selectedBrands],
      () => filtersStore.priceMin,
      () => filtersStore.priceMax,
      () => filtersStore.search,
    ],
  })

  return { products, pending, error }
}
