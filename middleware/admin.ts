export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) {
    return navigateTo('/login')
  }

  const authStore = useAuthStore()
  await authStore.fetchProfile()

  if (!authStore.isAdmin) {
    console.warn('[admin middleware] not admin. role:', authStore.profile?.role)
    return navigateTo('/')
  }
})
