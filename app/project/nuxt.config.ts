import { fileURLToPath } from 'node:url'

// Project layer (ARCHITECTURE-BLUEPRINT §2.4, §3; E6a). This shop's own
// identity: brand components, business data, the composables that read it and
// the project's app.config contributions. Core and the e-commerce module never
// import from here — they receive the brand through an app.config contribution
// (`brand`) and the WhatsApp button through `globalWidgets`.
//
// `#project` is the alias for intra-layer imports: `~`/`~~` resolve to the root
// app, so a project file must not reach another project file through them.
export default defineNuxtConfig({
  alias: {
    '#project': fileURLToPath(new URL('.', import.meta.url)),
  },
  // Flat naming, like the root app and the e-commerce layer: the `Project*`
  // prefix lives in the filenames.
  components: [{ path: './components', pathPrefix: false }],
})
