import registry from './modules.json'

/**
 * Module Registry (E8a; blueprint §"Module Registry", roadmap C2).
 *
 * `modules.json` is the project's answer to "which application modules run".
 * It is plain data so that everything that composes the app can read it without
 * a build step: this file for the root `nuxt.config.ts`, and — from E9 — the
 * backend composition and the boundary scripts, which is why the descriptor
 * already carries `backendDir` and `prismaSchema` that the frontend ignores.
 *
 * Composition-owned: it lives at the repository root, never under `app/core`,
 * so Core keeps no knowledge of which modules exist.
 *
 * Read at build time. A module is either compiled in or absent; there is no
 * runtime toggle, because disabling one must remove its code, not hide it.
 */
export interface ModuleDescriptor {
  /** Stable module id, e.g. `ecommerce`. */
  id: string
  /** Compiled in when true; a disabled module contributes nothing. */
  enabled: boolean
  /** The module's Nuxt layer, as the root `extends` needs it. */
  nuxtLayer: string
  /** The module's folder under `backend/src/` (E9). */
  backendDir: string
  /** The module's Prisma schema file under `backend/prisma/` (E9). */
  prismaSchema?: string
  /** Nuxt modules only this module needs (E8b+). */
  nuxtModules?: string[]
}

export const modules: ModuleDescriptor[] = registry.modules

/**
 * Layer paths of the enabled modules, in registry order. The root config places
 * them between Core and the project, which is where module layers belong in the
 * `extends` priority order.
 */
export const enabledModuleLayers: string[] = modules.filter((m) => m.enabled).map((m) => m.nuxtLayer)
