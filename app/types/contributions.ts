/**
 * Contribution lists read by the Core shells (`layouts/default.vue`, `AppHeader`,
 * `AccountSidebar`, `pages/account/index.vue`) from `app.config`.
 *
 * Core renders these lists and never names a module. Entries are declared in
 * `app/app.config.ts` today and move into each Nuxt layer's `app.config.ts`
 * when layers are introduced; Nuxt merges the arrays across layers.
 *
 * `component` is a **registered component name**. Contributed components use
 * the `.global.vue` suffix so Nuxt registers them globally and the shells can
 * render them with `<component :is="name">` without importing them.
 */

/** Storefront header link. `to` is an unlocalised path; the shell applies `localePath()`. */
export interface NavItemContribution {
  to: string
  labelKey: string
  order: number
}

/**
 * Component mounted in the header. `area: 'actions'` (default) is the right-hand
 * action cluster; `'center'` is the flexible desktop zone between the nav and the actions.
 */
export interface HeaderActionContribution {
  component: string
  order: number
  area?: 'center' | 'actions'
}

/** Component mounted once in the default layout (drawers, modals, floating widgets). */
export interface GlobalWidgetContribution {
  component: string
  order: number
}

/** Account sidebar link. `to` is an unlocalised path; the shell applies `localePath()`. */
export interface AccountItemContribution {
  to: string
  icon: string
  labelKey: string
  order: number
}

/** Component rendered as a block on the account dashboard, below the welcome header. */
export interface AccountCardContribution {
  component: string
  order: number
}

/**
 * An admin section (Admin Registry). The admin shell renders the sidebar,
 * decides which sections a staff member sees, resolves the page title and the
 * landing page after login from this list alone — it never names a section.
 *
 * `capability` is a *visibility* rule: the backend guards stay the authority
 * on what a request may do. `path` is unlocalised; the shell applies
 * `localePath()`. `icon` names an entry of the shell's icon set
 * (`components/admin/AdminIcon.vue`); an unknown name renders the fallback
 * glyph. `badgeStateKey` names a `useState<number>` key the shell reads for a
 * counter badge (the owning composable writes it).
 */
export interface AdminSectionContribution {
  /** Stable, unique id (`products`, `staff`, …). */
  id: string
  /** Unlocalised admin path (`/admin/products`). */
  path: string
  /** i18n key of the sidebar label and page title. */
  labelKey: string
  /** i18n key of the topbar subtitle. */
  subtitleKey?: string
  /** Icon name from the shell's icon set. */
  icon: string
  /** Capability required to see the section (the backend enforces the real one). */
  capability: string
  /** Sort key within the group; also the landing-page preference order. */
  order: number
  /** Group id from `adminGroups`; sections without one join the first group. */
  group?: string
  /** `exact`: active only on this path (the dashboard). Default `prefix`. */
  activeMatch?: 'exact' | 'prefix'
  /** `useState<number>` key rendered as a counter badge when > 0. */
  badgeStateKey?: string
  /** Static switch; `false` removes the section without deleting the entry. Default `true`. */
  enabled?: boolean
}

/** A sidebar group; the first group renders without a label. */
export interface AdminGroupContribution {
  id: string
  order: number
  /** i18n key of the group heading; omitted = no heading. */
  labelKey?: string
}

declare module 'nuxt/schema' {
  interface CustomAppConfig {
    navItems?: NavItemContribution[]
    headerActions?: HeaderActionContribution[]
    globalWidgets?: GlobalWidgetContribution[]
    accountItems?: AccountItemContribution[]
    accountCards?: AccountCardContribution[]
    adminGroups?: AdminGroupContribution[]
    adminSections?: AdminSectionContribution[]
  }
}
