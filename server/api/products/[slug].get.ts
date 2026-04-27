import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)
  const slug = getRouterParam(event, 'slug')

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('slug', slug!)
    .eq('is_active', true)
    .single()

  if (error) throw createError({ statusCode: 404, message: 'Product not found' })

  return data
})
