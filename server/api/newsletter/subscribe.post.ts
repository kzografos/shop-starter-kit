import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, data: { message: 'Invalid email address' } })
  }

  const client = serverSupabaseServiceRole(event)

  const { error } = await client
    .from('newsletter_subscribers')
    .upsert({ email: email.toLowerCase().trim() }, { onConflict: 'email', ignoreDuplicates: true })

  if (error) {
    console.error('[newsletter] supabase error:', error)
    throw createError({ statusCode: 500, data: { message: error.message } })
  }

  return { ok: true }
})
