import { fileURLToPath } from 'node:url'

// Core Nuxt layer (ARCHITECTURE-BLUEPRINT §3; E7). The application's own half:
// the API client, the session, permissions, the shells and the generic pages.
// The root nuxt.config.ts extends it first, so Core sits below the e-commerce
// module and the project in layer priority order while its plugins keep
// running last among the layers — the order they had at the app root.
//
// Core never imports from a module or from the project; those layers reach
// Core through the documented surface (useApi, the auth store, usePermissions,
// the registries) and contribute to it through app.config.
//
// `#core` is the alias for Core's own files and for the cross-layer imports of
// its surface: `~`/`~~` always resolve to the root app, so a layer file must
// not reach Core through them.
export default defineNuxtConfig({
  alias: {
    '#core': fileURLToPath(new URL('.', import.meta.url)),
  },
  // Flat naming, like the root app and the other layers: Core components keep
  // the names they have today (AppHeader, AccountSidebar, …) when they move in
  // E7d. Without this, a layer prefixes by directory (LayoutAppHeader…).
  components: [{ path: './components', pathPrefix: false }],
  // @pinia/nuxt scans `<srcDir>/stores` only, so a layer must name its own
  // store directory or its stores lose their auto-import (E5b).
  pinia: { storesDirs: [fileURLToPath(new URL('./stores/**', import.meta.url))] },
})
