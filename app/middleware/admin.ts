export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  const localePath = useLocalePath()

  if (!authStore.profile) await authStore.fetchProfile()
  if (!authStore.profile) return navigateTo(localePath('/login'))

  const { isStaff, can, requiredCapFor, firstAllowedPath } = usePermissions()
  if (!isStaff.value) return navigateTo('/')

  // Strict section gating: bounce to the user's first allowed section.
  const cap = requiredCapFor(to.path)
  if (cap && !can(cap)) return navigateTo(localePath(firstAllowedPath()))
})
