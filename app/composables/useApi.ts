// The single HTTP door to the backend (DEPENDENCY-RULES §5.3–5.4).
//
// It owns the base URL, the credentials policy and the 401 → refresh → retry
// dance. It knows nothing about stores: when a refresh fails it announces
// `api:unauthenticated` on the Nuxt app hooks and whoever owns the session
// (plugins/auth-hooks.ts) reacts. That keeps useApi ← store one-directional.

declare module '#app' {
  interface RuntimeNuxtHooks {
    /** Fired when a request was 401 and the refresh attempt also failed. */
    'api:unauthenticated': () => void | Promise<void>
  }
}

export const useApi = () => {
  let refreshing: Promise<boolean> | null = null
  const { public: { apiBase } } = useRuntimeConfig()
  const nuxtApp = useNuxtApp()

  const call = async <T>(url: string, opts?: Parameters<typeof $fetch>[1]): Promise<T> => {
    try {
      return await $fetch<T>(url, { baseURL: apiBase, credentials: 'include', ...opts })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status !== 401 || url.includes('/auth/')) throw err

      // Single-flight refresh: concurrent 401s share one /auth/refresh and all read its result.
      if (!refreshing) {
        refreshing = $fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' })
          .then(() => true)
          .catch(async () => {
            // Refresh failed (anonymous, or expired refresh token). Let the
            // session owner clear stale state; route middleware decides on
            // redirects — never force-navigate here.
            await nuxtApp.callHook('api:unauthenticated')
            return false
          })
          .finally(() => { refreshing = null })
      }

      const refreshOk = await refreshing
      if (!refreshOk) throw err
      return await $fetch<T>(url, { baseURL: apiBase, credentials: 'include', ...opts })
    }
  }

  return call
}
