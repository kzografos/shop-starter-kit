import { defineStore, skipHydrate } from 'pinia'
import type { Profile } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const api = useApi()
  const router = useRouter()
  const localePath = useLocalePath()
  const profile = ref<Profile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProfile() {
    loading.value = true
    error.value = null
    try {
      const data = await api<Profile>('/profile')
      profile.value = data ? structuredClone(data) : null
    } catch {
      profile.value = null
    } finally {
      loading.value = false
    }
  }

  // Drops the in-memory session without calling the API. Used when the API
  // client reports that the refresh token is gone (api:unauthenticated).
  function clearSession() {
    profile.value = null
  }

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    profile.value = null
    // Redirect after session fully cleared so no protected route flashes.
    const onAdmin = router.currentRoute.value.path.includes('/admin')
    await navigateTo(localePath(onAdmin ? '/login' : '/'))
  }

  const isAdmin = computed(() => profile.value?.role === 'admin')
  const loyaltyPoints = computed(() => profile.value?.loyalty_points ?? 0)
  const isLoggedIn = computed(() => !!profile.value)

  return { profile: skipHydrate(profile), loading, error, isAdmin, loyaltyPoints, isLoggedIn, fetchProfile, clearSession, signOut }
})
