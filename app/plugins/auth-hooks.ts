// Bridges the API client to the auth store in one direction only: useApi
// announces `api:unauthenticated`, the session owner reacts. Universal (runs
// on server and client) so a failed refresh during SSR clears the profile the
// same way it did when useApi wrote to the store directly.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('api:unauthenticated', () => {
    useAuthStore().clearSession()
  })
})
