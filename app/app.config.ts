import type {
  AccountCardContribution,
  AccountItemContribution,
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
})
