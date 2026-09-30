// Project contribution to the site's head: this store's LocalBusiness/Store
// JSON-LD. Registering it here rather than from app.vue keeps the composition
// root free of project code — the same way the shop layer registers its
// notification presenter. Universal, so SSR and the client emit one schema.
import { useBusinessSchema } from '#project/composables/useBusinessSchema'

export default defineNuxtPlugin(() => {
  useBusinessSchema()
})
