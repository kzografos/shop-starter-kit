export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) return navigateTo('/login')
  if (!authStore.profile) await authStore.fetchProfile()
  if (!authStore.isAdmin) return navigateTo('/')
})
