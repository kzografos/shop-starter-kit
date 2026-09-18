import type { Profile } from '~~/types'

export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  const headers = useRequestHeaders(['cookie'])
  const { public: { apiBase } } = useRuntimeConfig()

  try {
    const data = await $fetch<Profile>(`${apiBase}/profile`, { headers })
    authStore.profile = data ? structuredClone(data) : null
  } catch {
    authStore.profile = null
  }
})
