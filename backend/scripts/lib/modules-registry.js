'use strict'
/**
 * Tooling-time view of the Module Registry (E9b1; roadmap C2, F11).
 *
 * `modules.json` at the repository root decides which application modules run.
 * The boundary and audit scripts still carry their own copies of that knowledge
 * (`SHOP = ['modules']`, capability lists, Prisma model lists); this module is
 * what they will read instead, so the registry stays the single source of truth.
 *
 * Everything here is **derived**: the registry names a module's directories and
 * schema file, and the facts come from those files. Capability and model lists
 * are deliberately NOT registry metadata — duplicating them would reintroduce
 * exactly the drift the registry exists to prevent.
 *
 * Tooling-time only: plain CommonJS, read from the repository, never compiled
 * into `dist/` and never imported by Nest runtime code (a backend runtime import
 * of the root registry is what E9a proved impossible — `rootDir` inference and
 * the `./backend` Docker context).
 *
 * Every root is a parameter with a repository default, because the audit script
 * runs against synthetic trees through its `--backend/--frontend/--prisma` flags.
 */
const fs = require('node:fs')
const path = require('node:path')

const REPO = path.resolve(__dirname, '..', '..', '..')
const DEFAULTS = {
  registry: path.join(REPO, 'modules.json'),
  backendSrc: path.join(REPO, 'backend', 'src'),
  frontend: path.join(REPO, 'app'),
  prisma: path.join(REPO, 'backend', 'prisma'),
}

const posix = (p) => p.split(path.sep).join('/')

/**
 * Descriptors as declared, in registry order (the order the composition root
 * imports in). `trim`: an editor on Windows may leave a byte-order mark, which
 * JSON.parse rejects and `trim` counts as whitespace.
 */
function readRegistry(registryPath = DEFAULTS.registry) {
  const raw = JSON.parse(fs.readFileSync(registryPath, 'utf8').trim())
  if (!Array.isArray(raw.modules)) throw new Error(`modules-registry: ${registryPath} has no 'modules' array`)
  return raw.modules
}

/** Descriptors the project has switched on. */
function enabledModules(registryPath = DEFAULTS.registry) {
  return readRegistry(registryPath).filter((m) => m.enabled)
}

/**
 * Backend directories of the registered modules, relative to `backend/src`
 * (`modules/ecommerce`). Boundary rules apply to a module whether or not it is
 * enabled — a disabled module's files are still present and Core still must not
 * import them — so this covers every descriptor by default; pass
 * `{ enabledOnly: true }` where enablement genuinely matters.
 */
function backendDirs({ registryPath = DEFAULTS.registry, enabledOnly = false } = {}) {
  const modules = enabledOnly ? enabledModules(registryPath) : readRegistry(registryPath)
  return modules.filter((m) => m.backendDir).map((m) => posix(m.backendDir).replace(/\/+$/, ''))
}

/**
 * Frontend layer prefixes relative to the Nuxt srcDir (`modules/ecommerce/`),
 * derived from `nuxtLayer` (`./app/modules/ecommerce`) rather than assumed.
 */
function frontendPrefixes({ registryPath = DEFAULTS.registry, frontendRoot = DEFAULTS.frontend, repoRoot = REPO, enabledOnly = false } = {}) {
  const modules = enabledOnly ? enabledModules(registryPath) : readRegistry(registryPath)
  return modules
    .filter((m) => m.nuxtLayer)
    .map((m) => posix(path.relative(frontendRoot, path.resolve(repoRoot, m.nuxtLayer))) + '/')
}

/**
 * Prisma models owned by each module, as the Prisma client names them.
 *
 * Convention: a client property is its model with a lower-case first letter
 * (`OrderItem` → `orderItem`), which is what the current tooling's list uses and
 * what `prisma.<model>` reads in the source. Prisma's own rule is camelCase, so
 * a model named in caps (`ABTest`) would not round-trip through this; no such
 * model exists today.
 */
function moduleModels({ registryPath = DEFAULTS.registry, prismaRoot = DEFAULTS.prisma } = {}) {
  const models = []
  for (const m of readRegistry(registryPath)) {
    if (!m.prismaSchema) continue
    const file = path.join(prismaRoot, m.prismaSchema)
    if (!fs.existsSync(file)) continue
    const src = fs.readFileSync(file, 'utf8')
    for (const match of src.matchAll(/^model\s+(\w+)\s*\{/gm)) {
      const name = match[1]
      models.push(name[0].toLowerCase() + name.slice(1))
    }
  }
  return [...new Set(models)].sort()
}

/**
 * Capabilities a module **defines**, read from the `*-permissions.ts` files in
 * its backend directory.
 *
 * Definitions only. A module's registrar also *references* capabilities that
 * Core owns — the shop's role presets name `view:notifications` and
 * `manage:media` — and a plain search for quoted `x:y` strings would wrongly
 * attribute those to the module, which would make the boundary rule report
 * Core controllers for using Core's own capabilities. So the source of truth is
 * the argument of `defineCapabilities(...)`: either an inline array, or the name
 * of a const array declared in the same file (`ORDERS_CAPABILITIES`).
 */
function moduleCapabilities({ registryPath = DEFAULTS.registry, backendSrc = DEFAULTS.backendSrc } = {}) {
  const caps = []
  for (const dir of backendDirs({ registryPath })) {
    const root = path.join(backendSrc, dir)
    if (!fs.existsSync(root)) continue
    for (const file of walk(root)) {
      if (!file.endsWith('-permissions.ts')) continue
      const src = fs.readFileSync(file, 'utf8')
      for (const call of src.matchAll(/defineCapabilities\(\s*([^),]+)/g)) {
        const arg = call[1].trim()
        caps.push(...(arg.startsWith('[') ? literals(arg + src.slice(src.indexOf(arg) + arg.length)) : literals(declaration(src, arg))))
      }
    }
  }
  return [...new Set(caps)].sort()
}

/**
 * Frontend aliases of the module layers (`#shop` → `modules/ecommerce`), read
 * from the `alias` block of the layer's own `nuxt.config.ts`.
 *
 * The alias is not derivable from the module id (`ecommerce` declares `#shop`),
 * and the recon preferred reading the layer over widening the registry schema.
 * The parse is deliberately narrow: only the `alias: { … }` block of the config
 * named by `nuxtLayer`, only `'#name':` keys.
 */
function frontendAliases({ registryPath = DEFAULTS.registry, frontendRoot = DEFAULTS.frontend, repoRoot = REPO } = {}) {
  const aliases = {}
  for (const m of readRegistry(registryPath)) {
    if (!m.nuxtLayer) continue
    const layerDir = path.resolve(repoRoot, m.nuxtLayer)
    const config = path.join(layerDir, 'nuxt.config.ts')
    if (!fs.existsSync(config)) continue
    const block = /alias:\s*\{([\s\S]*?)\}/.exec(fs.readFileSync(config, 'utf8'))
    if (!block) continue
    for (const entry of block[1].matchAll(/'(#[A-Za-z][\w-]*)'\s*:/g)) {
      aliases[entry[1]] = posix(path.relative(frontendRoot, layerDir))
    }
  }
  return aliases
}

/**
 * Module directories that exist on disk but no descriptor claims (E9b4).
 *
 * Only the immediate children of `<backendSrc>/modules` count: a module is a
 * directory there, and anything deeper belongs to one. Registration is what is
 * checked, not enablement — a registered module that is switched off is still
 * declared, while an undeclared directory is composed by nobody and would be
 * dead code the layer map silently treats as a module.
 *
 * Returns paths in the same shape as `backendDirs()` (`modules/payments`).
 */
function unregisteredBackendDirs({ registryPath = DEFAULTS.registry, backendSrc = DEFAULTS.backendSrc } = {}) {
  const registered = new Set(backendDirs({ registryPath }))
  const parents = new Set(backendDirs({ registryPath }).map((d) => d.split('/')[0]))
  // Nothing registered yet: `modules/` is still the layer, so look there.
  if (!parents.size) parents.add('modules')
  const found = []
  for (const parent of parents) {
    const root = path.join(backendSrc, parent)
    if (!fs.existsSync(root)) continue
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = `${parent}/${entry.name}`
      if (!registered.has(dir)) found.push(dir)
    }
  }
  return found.sort()
}

// ── Helpers ──────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** The array literal a const declares, e.g. `const X = [ 'a', 'b' ] as const`. */
function declaration(src, name) {
  const at = new RegExp(`\\b(?:const|let|var)\\s+${name}\\b[^=]*=\\s*\\[`).exec(src)
  return at ? src.slice(at.index + at[0].length - 1) : ''
}

/** Quoted strings up to the end of the first array literal in `text`. */
function literals(text) {
  const end = text.indexOf(']')
  return [...(end === -1 ? text : text.slice(0, end)).matchAll(/'([^']+)'/g)].map((m) => m[1])
}

module.exports = {
  readRegistry,
  enabledModules,
  backendDirs,
  frontendPrefixes,
  moduleModels,
  moduleCapabilities,
  frontendAliases,
  unregisteredBackendDirs,
  DEFAULTS,
}
