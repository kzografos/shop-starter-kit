import type {
  AccountCardContribution,
  AccountItemContribution,
  AdminGroupContribution,
  AdminSectionContribution,
  GlobalWidgetContribution,
  HeaderActionContribution,
  NavItemContribution,
} from '~/types/contributions'

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

  // Contribution lists rendered by the Core shells (see app/types/contributions.ts).
  // Entries are sorted by `order`. Shop entries move into the e-commerce layer's
  // app.config.ts when Nuxt layers are introduced; the shells do not change.
  navItems: [
    { to: '/products', labelKey: 'nav.products', order: 10 },
    { to: '/brands', labelKey: 'nav.brands', order: 20 },
    { to: '/about', labelKey: 'nav.about', order: 30 },
    { to: '/contact', labelKey: 'nav.contact', order: 40 },
  ] satisfies NavItemContribution[],
  headerActions: [
    { component: 'HeaderSearch', order: 10, area: 'center' },
    { component: 'NotificationBell', order: 5 },
    { component: 'CartButton', order: 10 },
  ] satisfies HeaderActionContribution[],
  globalWidgets: [
    { component: 'CartDrawer', order: 10 },
  ] satisfies GlobalWidgetContribution[],
  accountItems: [
    { to: '/account/orders', icon: '📦', labelKey: 'account.orders', order: 10 },
    { to: '/account/notifications', icon: '🔔', labelKey: 'notifications.title', order: 15 },
    { to: '/account/favourites', icon: '❤️', labelKey: 'account.favourites', order: 20 },
    { to: '/account/loyalty', icon: '⭐', labelKey: 'account.loyalty', order: 30 },
  ] satisfies AccountItemContribution[],
  accountCards: [
    { component: 'LoyaltyCard', order: 10 },
    { component: 'AccountStats', order: 20 },
  ] satisfies AccountCardContribution[],

  // Admin Registry (docs/ADMIN-REGISTRY.md). The admin shell renders exactly
  // this list; `capability` decides who sees a section, the backend guard on
  // the section's routes decides what they may do. Order doubles as the
  // landing-page preference after login.
  adminGroups: [
    { id: 'main', order: 10 },
    { id: 'workspace', order: 20, labelKey: 'admin.group_workspace' },
  ] satisfies AdminGroupContribution[],
  adminSections: [
    // ── e-commerce (moves to the shop layer's app.config.ts with the layer split) ──
    { id: 'dashboard', path: '/admin', labelKey: 'admin.dashboard', subtitleKey: 'admin.subtitle_dashboard', icon: 'dashboard', capability: 'view:finance', order: 0, activeMatch: 'exact' },
    { id: 'analytics', path: '/admin/analytics', labelKey: 'admin.analytics', subtitleKey: 'admin.subtitle_analytics', icon: 'chart', capability: 'view:finance', order: 10 },
    { id: 'products', path: '/admin/products', labelKey: 'admin.products', subtitleKey: 'admin.subtitle_products', icon: 'box', capability: 'view:catalog', order: 20 },
    { id: 'categories', path: '/admin/categories', labelKey: 'admin.categories', subtitleKey: 'admin.subtitle_categories', icon: 'tag', capability: 'view:catalog', order: 30 },
    { id: 'orders', path: '/admin/orders', labelKey: 'admin.orders', subtitleKey: 'admin.subtitle_orders', icon: 'cart', capability: 'view:orders', order: 40 },
    // ── Core ──
    { id: 'notifications', path: '/admin/notifications', labelKey: 'admin.notifications', subtitleKey: 'admin.subtitle_notifications', icon: 'bell', capability: 'view:notifications', order: 50, badgeStateKey: 'admin-notif-unread' },
    { id: 'customers', path: '/admin/customers', labelKey: 'admin.customers', subtitleKey: 'admin.subtitle_customers', icon: 'users', capability: 'view:customers', order: 60, group: 'workspace' },
    { id: 'newsletter', path: '/admin/newsletter', labelKey: 'admin.newsletter', subtitleKey: 'admin.subtitle_newsletter', icon: 'mail', capability: 'manage:marketing', order: 70, group: 'workspace' },
    { id: 'staff', path: '/admin/staff', labelKey: 'admin.staff', subtitleKey: 'admin.subtitle_staff', icon: 'staff', capability: 'manage:staff', order: 80, group: 'workspace' },
    { id: 'settings', path: '/admin/settings', labelKey: 'admin.settings', subtitleKey: 'admin.subtitle_settings', icon: 'settings', capability: 'manage:settings', order: 90, group: 'workspace' },
  ] satisfies AdminSectionContribution[],
})
