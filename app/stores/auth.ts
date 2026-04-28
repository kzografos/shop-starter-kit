import { defineStore, skipHydrate } from 'pinia'
import type { Profile } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<Profile | null>(null)

  async function fetchProfile() {
    const supabase = useSupabaseClient()
    const user = useSupabaseUser()
    if (!user.value) {
      profile.value = null
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.sub)
      .single()
    // Normalize to plain object — strips null-prototype from Supabase response
    profile.value = data ? JSON.parse(JSON.stringify(data)) : null
  }

  async function signOut() {
    const supabase = useSupabaseClient()
    await supabase.auth.signOut()
    profile.value = null
  }

  const isAdmin = computed(() => profile.value?.role === 'admin')
  const loyaltyPoints = computed(() => profile.value?.loyalty_points ?? 0)
  const isLoggedIn = computed(() => !!useSupabaseUser().value)

  return { profile: skipHydrate(profile), isAdmin, loyaltyPoints, isLoggedIn, fetchProfile, signOut }
})
