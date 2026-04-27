import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)
  const query = getQuery(event)

  let dbQuery = supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (query.brand) dbQuery = dbQuery.eq('brand', query.brand as string)
  if (query.animal_age) dbQuery = dbQuery.eq('animal_age', query.animal_age as string)
  if (query.category_id) dbQuery = dbQuery.eq('category_id', query.category_id as string)
  if (query.search) {
    dbQuery = dbQuery.or(
      `name_el.ilike.%${query.search}%,name_en.ilike.%${query.search}%`
    )
  }

  const { data, error } = await dbQuery
  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
