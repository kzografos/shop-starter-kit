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
  // Same flat naming the root app uses: a layer's components/ would otherwise
  // be registered with its sub-directory as a prefix (FiltersHeaderSearch…),
  // which would rename components and break the app.config contributions that
  // name them. The layer prefix (`Shop*`) is E5c, done by renaming the files.
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
