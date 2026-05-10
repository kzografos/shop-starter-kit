import { z } from 'zod'
import { serverSupabaseClient } from '#supabase/server'

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
})

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)
  const query = getQuery(event)

  let parsed: z.infer<typeof querySchema>
  try {
    parsed = querySchema.parse(query)
  } catch (error) {
    if (error instanceof z.ZodError) throw createError({ statusCode: 400, message: error.message })
    throw error
  }

  const { page, limit } = parsed
  const from = (page - 1) * limit
  const to = from + limit - 1

  let dbQuery = supabase
    .from('products')
    .select('*, category:categories(*)', { count: 'exact' })
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

  const { data, count, error } = await dbQuery.range(from, to)
  if (error) throw createError({ statusCode: 500, message: error.message })

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  }
})
