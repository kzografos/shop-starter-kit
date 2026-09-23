import type { NavItemContribution } from '#core/types/contributions'

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
  // Entries are sorted by `order`. Core's live in the core layer's app.config.ts
  // (E7f) and the shop's in the module's (E8b); what remains here is the two
  // static pages of this project, which move with the project layer (C3).
  navItems: [
    { to: '/about', labelKey: 'nav.about', order: 30 },
    { to: '/contact', labelKey: 'nav.contact', order: 40 },
  ] satisfies NavItemContribution[],
})
