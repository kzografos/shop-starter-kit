export default defineNuxtRouteMiddleware(async (to) => {
  // Same reason as middleware/auth.ts: the server render cannot see the session
  // cookies, so fetchProfile() below always fails there and every hard
  // navigation to an admin page redirected to /login. Decide on the client.
  if (import.meta.server) return

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
