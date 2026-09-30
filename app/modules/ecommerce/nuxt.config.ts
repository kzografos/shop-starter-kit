import { fileURLToPath } from 'node:url'

// E-commerce Nuxt layer (ARCHITECTURE-BLUEPRINT §3, §10; E5). The root
// nuxt.config.ts `extends` this directory. The layer owns the shop's pages,
// components, composables, stores, utils, plugins, wire types, i18n
// namespaces and app.config contributions; it consumes Core only through the
// documented surface (useApi, the auth store, usePermissions, registries).
//
// `#shop` is the alias for intra-layer imports: `~`/`~~` always resolve to the
// root app, so a shop file must not import another shop file through them.
export default defineNuxtConfig({
  alias: {
    '#shop': fileURLToPath(new URL('.', import.meta.url)),
  },
  // Names come from the filenames, which carry the layer's `Shop*` prefix
  // (E5c). Directory-based prefixing stays off: it would prefix twice
  // (FiltersShopHeaderSearch…) and break the app.config contributions that
  // name these components as strings.
  components: [{ path: './components', pathPrefix: false }],
  // @pinia/nuxt scans `<srcDir>/stores` only, so a layer must name its own
  // store directory or its stores lose their auto-import.
  pinia: { storesDirs: [fileURLToPath(new URL('./stores/**', import.meta.url))] },
  i18n: {
    langDir: '.',
    locales: [
      { code: 'el', file: 'el.json' },
      { code: 'en', file: 'en.json' },
    ],
  },
})
