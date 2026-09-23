export default defineNuxtRouteMiddleware(async (to) => {
  // The session lives in httpOnly cookies that the server render never receives,
  // so a server-side verdict here is always "logged out". This middleware ran on
  // the server first and bounced signed-in customers to /login on every hard
  // navigation -- refreshing /account/orders, opening a favourite in a new tab,
  // or following a link from an order email all ended at the login form with a
  // perfectly valid session.
  //
  // Defer the decision to the client, where the profile request carries the
  // cookies. The page renders on the server as it always did.
  if (import.meta.server) return

  const authStore = useAuthStore()
  if (!authStore.profile) await authStore.fetchProfile()
  if (!authStore.isLoggedIn) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
