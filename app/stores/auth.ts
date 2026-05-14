import { defineStore, skipHydrate } from 'pinia'
import type { Profile } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<Profile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProfile() {
    const api = useApi()
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

  async function signOut() {
    const api = useApi()
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    profile.value = null
  }

  const isAdmin = computed(() => profile.value?.role === 'admin')
  const loyaltyPoints = computed(() => profile.value?.loyalty_points ?? 0)
  const isLoggedIn = computed(() => !!profile.value)

  return { profile: skipHydrate(profile), loading, error, isAdmin, loyaltyPoints, isLoggedIn, fetchProfile, signOut }
})
