import type {
  AccountCardContribution,
  AccountItemContribution,
  AdminSectionContribution,
  FooterColumnContribution,
  FooterItemContribution,
  GlobalWidgetContribution,
  HeaderActionContribution,
  HomeSectionContribution,
  NavItemContribution,
} from '#core/types/contributions'

// The shop's contributions to the Core registries (E8b, the deferred E5d).
// Nuxt merges every layer's app.config with the root's — arrays concatenate —
// and each registry orders its entries by `order`, so owning them here instead
// of at the composition root changes who declares them, not what renders.
// Disabling the module now removes its entries with it.
export default defineAppConfig({
  // Storefront nav.
  navItems: [
    { to: '/products', labelKey: 'nav.products', order: 10 },
    { to: '/brands', labelKey: 'nav.brands', order: 20 },
  ] satisfies NavItemContribution[],

  // Header: search in the centre zone, the cart button in the action cluster.
  headerActions: [
    { component: 'ShopHeaderSearch', order: 10, area: 'center' },
    { component: 'ShopCartButton', order: 10 },
  ] satisfies HeaderActionContribution[],

  // The cart drawer is mounted once by the default layout.
  globalWidgets: [
    { component: 'ShopCartDrawer', order: 10 },
  ] satisfies GlobalWidgetContribution[],

  // Home page sections (E8d2, E8d3), in the order the storefront shows them.
  homeSections: [
    { component: 'ShopHomeCategories', order: 10 },
    { component: 'ShopHomeDeals', order: 20 },
    { component: 'ShopBrandsMarquee', order: 30 },
  ] satisfies HomeSectionContribution[],

  // Account sidebar entries and dashboard cards.
  accountItems: [
    { to: '/account/orders', icon: '📦', labelKey: 'account.orders', order: 10 },
    { to: '/account/favourites', icon: '❤️', labelKey: 'account.favourites', order: 20 },
    { to: '/account/loyalty', icon: '⭐', labelKey: 'account.loyalty', order: 30 },
  ] satisfies AccountItemContribution[],
  accountCards: [
    { component: 'ShopLoyaltyCard', order: 10 },
    { component: 'ShopAccountStats', order: 20 },
  ] satisfies AccountCardContribution[],

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

  // Admin Registry (docs/ADMIN-REGISTRY.md): the shop's sections. The groups
  // and the Core sections are contributed by app/core/app.config.ts (E7f).
  adminSections: [
    { id: 'dashboard', path: '/admin', labelKey: 'admin.dashboard', subtitleKey: 'admin.subtitle_dashboard', icon: 'dashboard', capability: 'view:finance', order: 0, activeMatch: 'exact' },
    { id: 'analytics', path: '/admin/analytics', labelKey: 'admin.analytics', subtitleKey: 'admin.subtitle_analytics', icon: 'chart', capability: 'view:finance', order: 10 },
    { id: 'products', path: '/admin/products', labelKey: 'admin.products', subtitleKey: 'admin.subtitle_products', icon: 'box', capability: 'view:catalog', order: 20 },
    { id: 'categories', path: '/admin/categories', labelKey: 'admin.categories', subtitleKey: 'admin.subtitle_categories', icon: 'tag', capability: 'view:catalog', order: 30 },
    { id: 'orders', path: '/admin/orders', labelKey: 'admin.orders', subtitleKey: 'admin.subtitle_orders', icon: 'cart', capability: 'view:orders', order: 40 },
  ] satisfies AdminSectionContribution[],
})
