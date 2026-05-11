export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  if (user.value) return

  // useSupabaseUser() may still be null immediately after login due to async
  // SIGNED_IN event propagation — verify via getSession() before blocking.
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
