import { defineStore } from 'pinia'

export const useFavouritesStore = defineStore('favourites', () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const ids = ref<string[]>([])
  const loaded = ref(false)

  async function load() {
    if (!user.value) return
    const { data, error } = await supabase
      .from('favourites')
      .select('product_id')
    if (error) {
      console.error('[favourites] load error:', error)
      return
    }
    ids.value = (data ?? []).map((r: any) => String(r.product_id))
    loaded.value = true
  }

  async function toggle(productId: string) {
    if (!user.value) return
    const id = String(productId)
    if (ids.value.includes(id)) {
      ids.value = ids.value.filter(i => i !== id)
      const { error } = await supabase
        .from('favourites')
        .delete()
        .eq('product_id', id)
      if (error) {
        console.error('[favourites] delete error:', error)
        ids.value = [...ids.value, id]
      }
    } else {
      ids.value = [...ids.value, id]
      const { error } = await supabase
        .from('favourites')
        .insert({ product_id: id })
      if (error) {
        console.error('[favourites] insert error:', error)
        ids.value = ids.value.filter(i => i !== id)
      }
    }
  }

  function isFavourite(productId: string) {
    return ids.value.includes(String(productId))
  }

  watch(user, (u) => {
    if (u) load()
    else { ids.value = []; loaded.value = false }
  }, { immediate: true })

  return { ids, loaded, load, toggle, isFavourite }
})
