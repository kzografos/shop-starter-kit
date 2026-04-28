import { serverSupabaseServiceRole } from '#supabase/server'
import { sendNewsletterWelcome } from '../../utils/mailer'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)
  const normalised = email?.toLowerCase().trim()

  if (!normalised || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    throw createError({ statusCode: 400, data: { message: 'Invalid email address' } })
  }

  const client = serverSupabaseServiceRole(event)

  // Check if already subscribed so we don't re-send the welcome email
  const { data: existing } = await client
    .from('newsletter_subscribers')
    .select('email')
    .eq('email', normalised)
    .maybeSingle()

  const { error } = await client
    .from('newsletter_subscribers')
    .upsert({ email: normalised }, { onConflict: 'email', ignoreDuplicates: true })

  if (error) {
    console.error('[newsletter] supabase error:', error)
    throw createError({ statusCode: 500, data: { message: error.message } })
  }

  // Send welcome email only for genuinely new subscribers
  if (!existing) {
    await sendNewsletterWelcome(normalised).catch((err) =>
      console.error('[newsletter] email error:', err),
    )
  }

  return { ok: true }
})
