import { BUSINESS } from './utils/business'
import type { BrandContribution, GlobalWidgetContribution } from '~/types/contributions'

// Project contributions. Nuxt merges every layer's app.config with the root's
// (objects deep-merge, arrays concatenate), so the entries below are added to
// the Core and e-commerce ones, never replacing them.
export default defineAppConfig({
  // The component Core shells render wherever the brand appears (header,
  // footer, admin sidebar, auth pages). It accepts an optional `inverted`.
  brand: { component: 'ProjectBrandLockup' } satisfies BrandContribution,

  // Project-owned values the Core shells and app.vue render but must not know:
  // page titles, share cards, the brand name in copy, the footer's location.
  project: {
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    tagline: BUSINESS.tagline,
    favicon: BUSINESS.brand.favicon,
    ogImage: BUSINESS.brand.ogImage,
    city: BUSINESS.address.city,
    country: BUSINESS.address.countryName,
  },

  globalWidgets: [
    { component: 'ProjectWhatsAppButton', order: 20 },
  ] satisfies GlobalWidgetContribution[],
})
