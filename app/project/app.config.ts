import { BUSINESS } from './utils/business'
import type { BrandContribution, FooterColumnContribution, FooterItemContribution, GlobalWidgetContribution } from '#core/types/contributions'

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
    // Which i18n keys carry this project's footer copy (E6b). The keys live in
    // the root locale files; naming them here keeps the wording the project's.
    footer: {
      descriptionKey: 'footer.description',
      shippingKey: 'footer.shipping_info',
      rightsKey: 'footer.rights',
      madeWithLoveKey: 'footer.made_with_love',
    },
  },

  globalWidgets: [
    { component: 'ProjectWhatsAppButton', order: 20 },
  ] satisfies GlobalWidgetContribution[],

  // Footer (E6b): the project's info column — the two static pages plus the
  // shipping note, which is text rather than a link (no `to`).
  footerColumns: [
    { id: 'info', labelKey: 'footer.info', order: 40 },
  ] satisfies FooterColumnContribution[],
  footerItems: [
    { column: 'info', to: '/about', labelKey: 'nav.about', order: 10 },
    { column: 'info', to: '/contact', labelKey: 'nav.contact', order: 20 },
    { column: 'info', labelKey: 'footer.shipping_info', order: 30, icon: 'i-heroicons-truck' },
  ] satisfies FooterItemContribution[],
})
