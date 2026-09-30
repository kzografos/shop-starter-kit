import type { Profile } from '~~/types'

export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  const headers = useRequestHeaders(['cookie'])
  const { public: { apiBase } } = useRuntimeConfig()

  try {
    // raw-fetch: server-side render forwarding the browser's cookie header to
    // the API. useApi() adds `credentials: 'include'`, which means nothing on
    // the server, and its 401 → refresh path must not run here (a refresh from
    // the render would rotate the visitor's token without ever reaching their
    // browser). One read, no retry, session cleared on any failure.
    const data = await $fetch<Profile>(`${apiBase}/profile`, { headers })
    authStore.profile = data ? structuredClone(data) : null
  } catch {
    authStore.profile = null
  }
})
