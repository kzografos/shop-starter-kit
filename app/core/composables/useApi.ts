// The single HTTP door to the backend (DEPENDENCY-RULES §5.3–5.4,
// docs/USEAPI-MIGRATION.md).
//
// It owns the base URL, the credentials policy and the 401 → refresh → retry
// dance. It knows nothing about stores: when a refresh fails it announces
// `api:unauthenticated` on the Nuxt app hooks and whoever owns the session
// (core/plugins/auth-hooks.ts) reacts. That keeps useApi ← store one-directional.
//
// Errors are ofetch `FetchError`s, rethrown untouched: callers read
// `err.data.message` (the backend payload) and `err.response.status` /
// `err.statusCode`. Nothing is swallowed or rewritten here.

declare module '#app' {
  interface RuntimeNuxtHooks {
    /** Fired when a request was 401 and the refresh attempt also failed. */
    'api:unauthenticated': () => void | Promise<void>
  }
}

// One refresh in flight per browser tab, whichever useApi() instance hit the
// 401 first. Refresh tokens rotate (single use), so two instances refreshing
// at once would race: the second call finds the token already revoked and
// logs the user out. Client-only — the server has no browser cookies and each
// SSR request must stay isolated.
let clientRefreshing: Promise<boolean> | null = null

export const useApi = () => {
  let localRefreshing: Promise<boolean> | null = null
  const { public: { apiBase } } = useRuntimeConfig()
  const nuxtApp = useNuxtApp()

  const refresh = (): Promise<boolean> => {
    const current = import.meta.client ? clientRefreshing : localRefreshing
    if (current) return current
    const p = $fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(() => true)
      .catch(async () => {
        // Refresh failed (anonymous, or expired refresh token). Let the
        // session owner clear stale state; route middleware decides on
        // redirects — never force-navigate here.
        await nuxtApp.callHook('api:unauthenticated')
        return false
      })
      .finally(() => {
        if (import.meta.client) clientRefreshing = null
        else localRefreshing = null
      })
    if (import.meta.client) clientRefreshing = p
    else localRefreshing = p
    return p
  }

  const call = async <T>(url: string, opts?: Parameters<typeof $fetch>[1]): Promise<T> => {
    try {
      return await $fetch<T>(url, { baseURL: apiBase, credentials: 'include', ...opts })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status !== 401 || url.includes('/auth/')) throw err

      // Concurrent 401s share one /auth/refresh and all read its result.
      const refreshOk = await refresh()
      if (!refreshOk) throw err
      // Exactly one retry. Its own 401 (if any) propagates as-is.
      return await $fetch<T>(url, { baseURL: apiBase, credentials: 'include', ...opts })
    }
  }

  return call
}
