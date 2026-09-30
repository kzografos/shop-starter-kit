export default defineNuxtPlugin(() => {
  // Fire-and-forget — do NOT await: an awaited network call here blocks client
  // hydration and can wedge SPA navigation. The header reacts when profile resolves.
  const authStore = useAuthStore()
  authStore.fetchProfile().catch(() => {})
})
