import type {
  AccountCardContribution,
  AccountItemContribution,
  AdminSectionContribution,
  GlobalWidgetContribution,
  HeaderActionContribution,
  NavItemContribution,
} from '#core/types/contributions'

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'terracotta',
    },
    toast: {
      slots: {
        root: 'bg-surface-card border border-[--color-border-warm] shadow-md',
      },
    },
  },

  // Contribution lists rendered by the Core shells (see app/core/types/contributions.ts).
  // Entries are sorted by `order`. Core's own entries live in the core layer's
  // app.config.ts (E7f); the shop entries below still wait for their move into
  // app/modules/ecommerce/app.config.ts. The shells do not change either way.
  navItems: [
    { to: '/products', labelKey: 'nav.products', order: 10 },
    { to: '/brands', labelKey: 'nav.brands', order: 20 },
    { to: '/about', labelKey: 'nav.about', order: 30 },
    { to: '/contact', labelKey: 'nav.contact', order: 40 },
  ] satisfies NavItemContribution[],
  headerActions: [
    { component: 'ShopHeaderSearch', order: 10, area: 'center' },
    { component: 'ShopCartButton', order: 10 },
  ] satisfies HeaderActionContribution[],
  globalWidgets: [
    { component: 'ShopCartDrawer', order: 10 },
  ] satisfies GlobalWidgetContribution[],
  accountItems: [
    { to: '/account/orders', icon: '📦', labelKey: 'account.orders', order: 10 },
    { to: '/account/favourites', icon: '❤️', labelKey: 'account.favourites', order: 20 },
    { to: '/account/loyalty', icon: '⭐', labelKey: 'account.loyalty', order: 30 },
  ] satisfies AccountItemContribution[],
  accountCards: [
    { component: 'ShopLoyaltyCard', order: 10 },
    { component: 'ShopAccountStats', order: 20 },
  ] satisfies AccountCardContribution[],

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
