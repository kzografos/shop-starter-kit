import type {
  AccountItemContribution,
  AdminGroupContribution,
  AdminSectionContribution,
  FooterColumnContribution,
  FooterItemContribution,
  HeaderActionContribution,
} from '#core/types/contributions'

// Core's own contributions to the registries it renders (E7f). Nuxt merges
// every layer's app.config with the root's — objects deep-merge, arrays
// concatenate — and each registry orders its entries by `order`, so declaring
// them here instead of at the composition root changes ownership, not output.
export default defineAppConfig({
  // The notification bell Core owns; the shop contributes search and the cart.
  // Typed as the contract rather than `satisfies`, so the merged app.config
  // keeps the optional `area` the header reads: inferred on its own, this
  // entry would widen to a member without that key at all.
  headerActions: [
    { component: 'NotificationBell', order: 5 },
  ] as HeaderActionContribution[],

  // Core's account entry: the notification feed.
  accountItems: [
    { to: '/account/notifications', icon: '🔔', labelKey: 'notifications.title', order: 15 },
  ] satisfies AccountItemContribution[],

  // Footer: Core declares the account column and its dashboard link; the shop
  // adds orders/loyalty to the same column.
  footerColumns: [
    { id: 'account', labelKey: 'footer.account_title', order: 30 },
  ] satisfies FooterColumnContribution[],
  footerItems: [
    { column: 'account', to: '/account', labelKey: 'nav.account', order: 10 },
  ] satisfies FooterItemContribution[],

  // Admin Registry (docs/ADMIN-REGISTRY.md). The groups are the shell's own
  // vocabulary; the sections below are the Core domains. `capability` decides
  // who sees a section, the backend guard on its routes decides what they may
  // do, and `order` doubles as the landing-page preference after login.
  adminGroups: [
    { id: 'main', order: 10 },
    { id: 'workspace', order: 20, labelKey: 'admin.group_workspace' },
  ] satisfies AdminGroupContribution[],
  adminSections: [
    { id: 'notifications', path: '/admin/notifications', labelKey: 'admin.notifications', subtitleKey: 'admin.subtitle_notifications', icon: 'bell', capability: 'view:notifications', order: 50, badgeStateKey: 'admin-notif-unread' },
    { id: 'customers', path: '/admin/customers', labelKey: 'admin.customers', subtitleKey: 'admin.subtitle_customers', icon: 'users', capability: 'view:customers', order: 60, group: 'workspace' },
    { id: 'newsletter', path: '/admin/newsletter', labelKey: 'admin.newsletter', subtitleKey: 'admin.subtitle_newsletter', icon: 'mail', capability: 'manage:marketing', order: 70, group: 'workspace' },
    { id: 'staff', path: '/admin/staff', labelKey: 'admin.staff', subtitleKey: 'admin.subtitle_staff', icon: 'staff', capability: 'manage:staff', order: 80, group: 'workspace' },
    { id: 'settings', path: '/admin/settings', labelKey: 'admin.settings', subtitleKey: 'admin.subtitle_settings', icon: 'settings', capability: 'manage:settings', order: 90, group: 'workspace' },
  ] satisfies AdminSectionContribution[],
})
