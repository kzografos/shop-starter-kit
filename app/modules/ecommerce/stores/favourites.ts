import { defineStore } from 'pinia'

export const useFavouritesStore = defineStore('favourites', () => {
  const api = useApi()
  const authStore = useAuthStore()

  const ids = ref<string[]>([])
  const loaded = ref(false)

  async function load() {
    if (!authStore.isLoggedIn) return
    try {
      const data = await api<string[]>('/favourites/ids')
      ids.value = data
      loaded.value = true
    } catch {
      ids.value = []
    }
  }

  async function toggle(productId: string) {
    if (!authStore.isLoggedIn) return
    const id = String(productId)
    const wasIn = ids.value.includes(id)

    // Optimistic update
    if (wasIn) ids.value = ids.value.filter((i) => i !== id)
    else ids.value = [...ids.value, id]

    try {
      const res = await api<{ action: string; product_id: string }>('/favourites/toggle', {
        method: 'POST',
        body: { productId: id },
      })
      // Sync with server response
      if (res.action === 'added' && !ids.value.includes(id)) ids.value = [...ids.value, id]
      if (res.action === 'removed') ids.value = ids.value.filter((i) => i !== id)
    } catch {
      // Rollback on error
      if (wasIn) ids.value = [...ids.value, id]
      else ids.value = ids.value.filter((i) => i !== id)
    }
  }

  function isFavourite(productId: string) {
    return ids.value.includes(String(productId))
  }

  watch(
    () => authStore.isLoggedIn,
    (loggedIn) => {
      if (loggedIn) load()
      else { ids.value = []; loaded.value = false }
    },
    { immediate: true },
  )

  return { ids, loaded, load, toggle, isFavourite }
})
