import type { Type } from '@nestjs/common'
import { EcommerceModule } from './modules/ecommerce/ecommerce.module'
import { enabledModuleIds } from './modules.enabled'

/**
 * Backend half of the Module Registry (E9a; roadmap C2). `modules.json` decides
 * which application modules run; `modules.enabled.ts` carries those ids into the
 * backend as generated data, and this map turns them into the Nest modules the
 * composition root imports.
 *
 * The registry stays data and this map stays code: a class reference cannot live
 * in JSON, so ids resolve statically here. Nothing is loaded by path, by
 * `require` or by reflection — the imports are compile-time, so a disabled
 * module leaves the composition rather than merely sitting unused.
 *
 * Composition-owned: it sits beside app.module.ts, never under core/ or
 * infrastructure/, so Core keeps no knowledge of which modules exist.
 */
const MODULE_CLASSES: Record<string, Type> = {
  ecommerce: EcommerceModule,
}

export const enabledModules: Type[] = enabledModuleIds.map((id) => {
  const moduleClass = MODULE_CLASSES[id]
  // An enabled id with no Nest module is a composition error: fail at boot
  // rather than start an application that silently serves nothing.
  if (!moduleClass) throw new Error(`No Nest module registered for the enabled module "${id}"`)
  return moduleClass
})
