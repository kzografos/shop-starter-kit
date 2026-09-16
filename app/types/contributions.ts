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

declare module 'nuxt/schema' {
  interface CustomAppConfig {
    navItems?: NavItemContribution[]
    headerActions?: HeaderActionContribution[]
    globalWidgets?: GlobalWidgetContribution[]
    accountItems?: AccountItemContribution[]
    accountCards?: AccountCardContribution[]
  }
}
