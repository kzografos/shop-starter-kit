import { defineStore, skipHydrate } from 'pinia'
import type { Profile } from '~/types'
import type { Database } from '~/types/database.types'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<Profile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProfile() {
    const supabase = useSupabaseClient<Database>()
    const user = useSupabaseUser()
    if (!user.value) {
      profile.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.sub)
        .single()
      // Normalize to plain object — strips null-prototype from Supabase response
      profile.value = data ? structuredClone(data) : null
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    const supabase = useSupabaseClient<Database>()
    await supabase.auth.signOut()
    profile.value = null
  }

  const isAdmin = computed(() => profile.value?.role === 'admin')
  const loyaltyPoints = computed(() => profile.value?.loyalty_points ?? 0)
  const isLoggedIn = computed(() => !!useSupabaseUser().value)

  return { profile: skipHydrate(profile), loading, error, isAdmin, loyaltyPoints, isLoggedIn, fetchProfile, signOut }
})
