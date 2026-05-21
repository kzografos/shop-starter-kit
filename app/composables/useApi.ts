export const useApi = () => {
  let refreshing: Promise<void> | null = null
  const { public: { apiBase } } = useRuntimeConfig()

  const call = async <T>(url: string, opts?: Parameters<typeof $fetch>[1]): Promise<T> => {
    try {
      return await $fetch<T>(url, { baseURL: apiBase, credentials: 'include', ...opts })
    } catch (err: any) {
      if (err?.response?.status !== 401 || url.includes('/auth/')) throw err

      if (!refreshing) {
        refreshing = $fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' })
          .catch(async () => {
            useAuthStore().profile = null
            await navigateTo('/login')
          })
          .finally(() => { refreshing = null })
      }

      await refreshing
      return await $fetch<T>(url, { baseURL: apiBase, credentials: 'include', ...opts })
    }
  }

  return call
}
