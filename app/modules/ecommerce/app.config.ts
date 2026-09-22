import type { FooterColumnContribution, FooterItemContribution } from '~/types/contributions'

// Shop contributions to the Core registries (nav items, header actions, global
// widgets, account items/cards, admin sections) move here from the root
// app.config.ts in E5d. Nuxt merges layer app.config with the root's (arrays
// concatenate; the registries order entries by `order`).
export default defineAppConfig({
  // Footer (E6b): the shop's own column plus the two order/loyalty entries of
  // the account column Core declares.
  footerColumns: [
    { id: 'shop', labelKey: 'footer.shop', order: 20 },
  ] satisfies FooterColumnContribution[],
  footerItems: [
    { column: 'shop', to: '/products', labelKey: 'nav.products', order: 10 },
    { column: 'account', to: '/account/orders', labelKey: 'account.orders', order: 20 },
    { column: 'account', to: '/account/loyalty', labelKey: 'footer.loyalty', order: 30 },
  ] satisfies FooterItemContribution[],
})
