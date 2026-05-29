export const useApi = () => {
  let refreshing: Promise<boolean> | null = null
  const { public: { apiBase } } = useRuntimeConfig()

  const call = async <T>(url: string, opts?: Parameters<typeof $fetch>[1]): Promise<T> => {
    try {
      return await $fetch<T>(url, { baseURL: apiBase, credentials: 'include', ...opts })
    } catch (err: any) {
      if (err?.response?.status !== 401 || url.includes('/auth/')) throw err

      // Single-flight refresh: concurrent 401s share one /auth/refresh and all read its result.
      if (!refreshing) {
        refreshing = $fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' })
          .then(() => true)
          .catch(() => {
            // Refresh failed (anonymous, or expired refresh token).
            // Clear stale profile; let route middleware decide on redirects — never force-navigate here.
            useAuthStore().profile = null
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
