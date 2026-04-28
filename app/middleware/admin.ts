export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')

  const authStore = useAuthStore()

  // Use cached profile if already fetched this session
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  if (!authStore.isAdmin) {
    return navigateTo('/')
  }
})
