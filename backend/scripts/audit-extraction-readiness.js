#!/usr/bin/env node
/**
 * Extraction-readiness audit (docs/EXTRACTION-READINESS.md §14).
 *
 * Read-only, deterministic scan of the backend (`backend/src`) and the
 * frontend (`app/`, `types/`) source trees. It builds a file-level import
 * graph, tags every file with an ownership layer, and reports the edges that
 * matter for splitting Core from Shop: cross-layer edges, cycles, and the
 * relationships it could only partly resolve. No build, no dependencies, no
 * network. It never changes anything.
 *
 *   node scripts/audit-extraction-readiness.js            # human summary
 *   node scripts/audit-extraction-readiness.js --json     # machine output
 *   node scripts/audit-extraction-readiness.js --strict   # exit 1 on a forbidden edge
 *   node scripts/audit-extraction-readiness.js --backend <dir> --frontend <dir> --types <dir>
 *
 * What it resolves
 *   backend  relative imports (runtime vs `import type`), constructor DI by
 *            class name (`private x: SomeService`), Prisma model access
 *            (`prisma.<model>` / `tx.<model>`) mapped to the schema file that
 *            owns the model, `events.emit/on('<name>')`, ConfigService /
 *            process.env use.
 *   frontend relative + `~/`, `~~/`, `@/`, `@@/`, `#core/`, `#shop/`, `#project/` imports (runtime vs type),
 *            Nuxt component auto-imports found in templates (`<PascalCase`,
 *            `components/**` with pathPrefix false, `.global.vue` stripped),
 *            composable/store auto-imports (`useXxx(` → composables/useXxx.ts,
 *            `useXxxStore(` → stores/xxx.ts), and the component names that
 *            `app.config.ts` contributes as strings (`component: 'Name'`).
 *
 * What it does NOT resolve (reported under `unresolved`, never guessed)
 *   dynamic `import()`, `resolveComponent()` / `<component :is>` targets,
 *   Nuxt auto-imported utils (they are imported explicitly by convention),
 *   NestJS providers wired by token/factory rather than class, Prisma
 *   relations traversed through `include`/`select`, i18n keys, and anything
 *   in node_modules. Layers are a path map (below), not inferred.
 *
 * Report only, outside the graph (`frontend.nonTs`, N0)
 *   who uses each key of the root locale files (`i18n/*.json`), who refers to
 *   each `public/` asset, where each CSS custom property is defined and read
 *   (var(), `[--x]`, and the Tailwind utilities an @theme token generates),
 *   and which layers name each font family. Informational: nothing in it is a
 *   forbidden edge and `--strict` ignores it.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const registry = require('./lib/modules-registry')

// ── CLI ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const flag = (name) => argv.includes(name)
const REPO = path.resolve(__dirname, '..', '..')
const BACKEND = path.resolve(opt('--backend') ?? path.join(REPO, 'backend', 'src'))
const FRONTEND = path.resolve(opt('--frontend') ?? path.join(REPO, 'app'))
const TYPES = path.resolve(opt('--types') ?? path.join(REPO, 'types'))
const PRISMA = path.resolve(opt('--prisma') ?? path.join(REPO, 'backend', 'prisma'))

// ── Layer maps ───────────────────────────────────────────────────
// Backend: same folder map as verify-boundaries.js (blueprint §2).
const BE_INFRA = ['infrastructure'] // prisma, redis, storage, payments-provider, mail, health, common (E2)
const BE_CORE = ['core'] // auth, users, profile, staff, settings, notifications, newsletter, uploads, config, events (E3a)
const BE_SHOP = ['modules'] // modules/ecommerce/{products, categories, favourites, orders, payments, loyalty, analytics} (E3a)
const beLayer = (rel) => {
  const top = rel.includes('/') ? rel.split('/')[0] : null
  if (top === null) return 'ROOT' // app.module.ts, main.ts — composition root
  if (BE_INFRA.includes(top)) return 'INFRASTRUCTURE'
  if (BE_CORE.includes(top)) return 'CORE'
  if (BE_SHOP.includes(top)) return 'SHOP'
  return 'UNMAPPED'
}

// Frontend: folders are Core by default; shop files are listed explicitly
// because they still live in Core folders (MODULE-REGISTRY F8). Project =
// this shop's own content (brand, business facts), neither Core nor Shop.
// Shop is the e-commerce Nuxt layer (E5b): everything under it, including its
// own `types/`. The per-file lists are empty now that the move is complete;
// they stay as the hook for a future module that is not yet a layer.
// Module layer prefixes relative to the Nuxt srcDir, derived from each
// descriptor's `nuxtLayer` (E9b3). `repoRoot` is the parent of the frontend
// root so a synthetic tree (`--frontend`) resolves its own layers, not the
// repository's. Registered modules count whether or not they are enabled: the
// files are there either way, and the layer they belong to does not change.
const FE_SHOP_PREFIXES = registry.frontendPrefixes({ frontendRoot: FRONTEND, repoRoot: path.dirname(FRONTEND) })
const FE_SHOP_FILES = []
// The project layer (E6a) plus the one project-owned file that stays at the
// app root: the composition root's app.config.
const FE_PROJECT_PREFIXES = ['project/']
const FE_PROJECT_FILES = [
  'app.config.ts',
]
const MODULE_ALIASES = registry.frontendAliases({ frontendRoot: FRONTEND, repoRoot: path.dirname(FRONTEND) })
// The composition root (N0): the files directly in the app root (app.vue), its
// own plugins and its assets belong to no layer. Deliberately narrow — other
// root folders keep the Core default. The project exception above still wins
// for app.config.ts.
const FE_ROOT_DIRS = ['plugins', 'assets']

const feLayer = (rel) => {
  if (FE_SHOP_FILES.includes(rel) || FE_SHOP_PREFIXES.some((p) => rel.startsWith(p))) return 'SHOP' // incl. modules/ecommerce/types (E5b)
  if (rel.startsWith('types/')) return 'SHARED' // root types/index.ts — Core wire contracts
  if (FE_PROJECT_FILES.includes(rel) || FE_PROJECT_PREFIXES.some((p) => rel.startsWith(p))) return 'PROJECT'
  if (rel.startsWith('../')) return 'ROOT' // repository-root files read by the report (nuxt.config.ts)
  if (!rel.includes('/') || FE_ROOT_DIRS.some((d) => rel.startsWith(d + '/'))) return 'ROOT'
  return 'CORE'
}

// Edges a Core/Shop split cannot survive. Registry-driven references
// (app.config strings, DI through global modules) are reported, not forbidden.
const FORBIDDEN = {
  backend: [['CORE', 'SHOP'], ['INFRASTRUCTURE', 'SHOP'], ['INFRASTRUCTURE', 'CORE']],
  frontend: [['CORE', 'SHOP'], ['CORE', 'PROJECT']],
}

// ── Helpers ──────────────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.output', 'dist', 'assets', 'public'])
function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), exts, out); continue }
    if (exts.some((e) => entry.name.endsWith(e)) && !entry.name.endsWith('.d.ts')) out.push(path.join(dir, entry.name))
  }
  return out
}
const posix = (p) => p.split(path.sep).join('/')
// Comments mention identifiers too (`Read via useLoyalty()`); name-based matching ignores them.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\*.*$/gm, '')
const stripExt = (p) => p.replace(/\.(ts|vue|mjs|js)$/, '')

/** import / export-from statements → [{ spec, typeOnly }] */
function importSpecs(src) {
  const out = []
  const re = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(src))) {
    if (m[1] === 'export' && !/from/.test(m[0])) continue
    // `import { type A, type B } from` counts as type-only when every specifier is `type`
    const specifiers = m[0].match(/\{([^}]*)\}/)?.[1]
    const allType = specifiers ? specifiers.split(',').map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith('type ')) : false
    out.push({ spec: m[3], typeOnly: Boolean(m[2]) || allType })
  }
  return out
}

function resolveFile(base, candidates) {
  for (const c of candidates) {
    for (const ext of ['', '.ts', '.vue', '.mjs', '.js', '/index.ts']) {
      const full = c + ext
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full
    }
  }
  return null
}

// ── Backend scan ─────────────────────────────────────────────────
function scanBackend() {
  const files = walk(BACKEND, ['.ts'])
  const rel = (f) => posix(path.relative(BACKEND, f))
  const nodes = files.map((f) => ({ file: rel(f), layer: beLayer(rel(f)) }))
  const byRel = new Map(nodes.map((n) => [n.file, n]))
  const classToFile = new Map()
  const sources = new Map()
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8'); sources.set(f, src)
    for (const m of src.matchAll(/export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/g)) classToFile.set(m[1], rel(f))
  }
  // Prisma model ownership from the schema files
  const models = new Map() // modelName(camel) → schema file
  for (const schema of walk(PRISMA, ['.prisma'])) {
    if (schema.includes(`${path.sep}migrations${path.sep}`)) continue
    const s = fs.readFileSync(schema, 'utf8')
    for (const m of s.matchAll(/^model\s+([A-Za-z0-9_]+)/gm)) models.set(m[1][0].toLowerCase() + m[1].slice(1), path.basename(schema))
  }
  const modelLayer = (schemaFile) => ({ 'core.prisma': 'CORE', 'ecommerce.prisma': 'SHOP', 'infrastructure.prisma': 'INFRASTRUCTURE' })[schemaFile] ?? 'UNMAPPED'

  const edges = [] // { from, to, kind: import|type|di|prisma|event, detail }
  const unresolved = []
  const events = { publishers: [], subscribers: [] }
  const config = []
  for (const f of files) {
    const src = stripComments(sources.get(f)), from = rel(f)
    for (const { spec, typeOnly } of importSpecs(src)) {
      if (!spec.startsWith('.')) continue // package import
      const target = resolveFile(null, [path.resolve(path.dirname(f), spec)])
      if (!target) { unresolved.push({ file: from, spec, reason: 'relative import not found' }); continue }
      edges.push({ from, to: rel(target), kind: typeOnly ? 'type' : 'import', detail: spec })
    }
    // constructor DI: `private readonly x: ClassName,` / `private x: ClassName`
    const ctor = src.match(/constructor\s*\(([\s\S]*?)\)\s*\{/)
    if (ctor) {
      for (const m of ctor[1].matchAll(/(?:private|public|protected|readonly)[\s\w]*?:\s*([A-Z][A-Za-z0-9_]*)/g)) {
        const target = classToFile.get(m[1])
        if (target && target !== from) edges.push({ from, to: target, kind: 'di', detail: m[1] })
        else if (!target && !['ConfigService', 'JwtService', 'Logger', 'Reflector', 'HealthCheckService', 'PrismaHealthIndicator', 'Response', 'Request'].includes(m[1])) unresolved.push({ file: from, spec: m[1], reason: 'DI token not a class in src (package or factory provider)' })
      }
    }
    // Prisma model access
    const seen = new Set()
    for (const m of src.matchAll(/\b(?:prisma|tx|client)\.([a-z][A-Za-z0-9]*)\s*\./g)) {
      const model = m[1]
      if (!models.has(model) || seen.has(model)) continue
      seen.add(model)
      edges.push({ from, to: `prisma/${models.get(model)}#${model}`, kind: 'prisma', detail: model, toLayer: modelLayer(models.get(model)) })
    }
    for (const m of src.matchAll(/events\.emit\(\s*'([^']+)'/g)) events.publishers.push({ file: from, event: m[1] })
    for (const m of src.matchAll(/events\.on\(\s*'([^']+)'/g)) events.subscribers.push({ file: from, event: m[1] })
    if (/ConfigService|process\.env/.test(src)) config.push(from)
    if (/import\(/.test(src)) unresolved.push({ file: from, spec: 'import()', reason: 'dynamic import not followed' })
  }
  const layerOf = (e, end) => end === 'to' && e.toLayer ? e.toLayer : byRel.get(e[end])?.layer ?? 'EXTERNAL'
  for (const e of edges) { e.fromLayer = layerOf(e, 'from'); e.toLayer = layerOf(e, 'to') }
  return { files: nodes, edges, unresolved, events, config, models: [...models].map(([m, f]) => ({ model: m, schema: f, layer: modelLayer(f) })) }
}

// ── Frontend scan ────────────────────────────────────────────────
function scanFrontend() {
  const appFiles = walk(FRONTEND, ['.ts', '.vue'])
  const typeFiles = walk(TYPES, ['.ts'])
  const rel = (f) => (f.startsWith(TYPES) ? 'types/' + posix(path.relative(TYPES, f)) : posix(path.relative(FRONTEND, f)))
  const files = [...appFiles, ...typeFiles]
  const nodes = files.map((f) => ({ file: rel(f), layer: feLayer(rel(f)) }))
  const byRel = new Map(nodes.map((n) => [n.file, n]))
  // Nuxt auto-import tables. Every layer contributes its own components/,
  // composables/ and stores/ (E5: `modules/<module>/…`), so the tables are keyed
  // by the directory name wherever it appears, not only at the app root.
  // `components/x.vue` at the app root, `modules/<module>/components/x.vue` and
  // `project/components/x.vue` all register the same way.
  const inDir = (r, dir) => { const i = r.split('/').indexOf(dir); return i !== -1 && i <= 2 }
  const components = new Map() // Name → rel file
  const composables = new Map(), stores = new Map()
  for (const f of appFiles) {
    const r = rel(f)
    const base = path.basename(r)
    if (inDir(r, 'components') && r.endsWith('.vue')) components.set(base.replace(/\.global\.vue$|\.vue$/, ''), r)
    if (inDir(r, 'composables')) composables.set(stripExt(base), r)
    if (inDir(r, 'stores')) stores.set('use' + stripExt(base)[0].toUpperCase() + stripExt(base).slice(1) + 'Store', r)
  }
  const aliasRoot = (spec) => {
    if (spec.startsWith('#core/')) return path.join(FRONTEND, 'core', spec.slice(6)) // Core layer alias (its nuxt.config.ts)
    // Module layer aliases (`#shop` → modules/ecommerce) read from each layer's
    // own nuxt.config.ts by the registry helper (E9b3), so a module's alias is
    // never assumed from its id.
    for (const [alias, dir] of Object.entries(MODULE_ALIASES)) {
      if (spec.startsWith(alias + '/')) return path.join(FRONTEND, dir, spec.slice(alias.length + 1))
    }
    if (spec.startsWith('#project/')) return path.join(FRONTEND, 'project', spec.slice(9)) // project layer alias (its nuxt.config.ts)
    if (spec.startsWith('~~/') || spec.startsWith('@@/')) return path.join(FRONTEND, '..', spec.slice(3))
    if (spec.startsWith('~/') || spec.startsWith('@/')) return path.join(FRONTEND, spec.slice(2))
    return null
  }
  const edges = [], unresolved = []
  let packageComponents = 0 // Nuxt UI (`U*`) and other module-provided components: resolvable by Nuxt, outside this tree
  for (const f of files) {
    const src = stripComments(fs.readFileSync(f, 'utf8')), from = rel(f)
    for (const { spec, typeOnly } of importSpecs(src)) {
      let base = null
      if (spec.startsWith('.')) base = path.resolve(path.dirname(f), spec)
      else if (aliasRoot(spec)) base = aliasRoot(spec)
      else continue // package import
      const target = resolveFile(null, [base])
      if (!target) { unresolved.push({ file: from, spec, reason: 'alias/relative import not found' }); continue }
      edges.push({ from, to: rel(target), kind: typeOnly ? 'type' : 'import', detail: spec })
    }
    if (f.endsWith('.vue')) {
      const template = src.match(/<template[\s\S]*<\/template>/)?.[0] ?? ''
      const seen = new Set()
      for (const m of template.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)) {
        const name = m[1]
        if (seen.has(name)) continue; seen.add(name)
        const target = components.get(name)
        if (target && target !== from) edges.push({ from, to: target, kind: 'auto-component', detail: `<${name}>` })
        else if (!target && (/^U[A-Z]/.test(name) || ['NuxtLink', 'NuxtPage', 'NuxtLayout', 'NuxtImg', 'ClientOnly', 'Transition', 'TransitionGroup', 'Teleport', 'KeepAlive', 'Suspense', 'NuxtLoadingIndicator', 'NuxtErrorBoundary'].includes(name))) packageComponents++
        else if (!target) unresolved.push({ file: from, spec: name, reason: 'component not in components/ (local, package or dynamic)' })
      }
      if (/<component\s+:is=|resolveComponent\(/.test(src)) unresolved.push({ file: from, spec: '<component :is>', reason: 'dynamic component target decided at runtime (registry contribution)' })
    }
    const seenAuto = new Set()
    for (const m of src.matchAll(/\b(use[A-Z][A-Za-z0-9]*)\s*\(/g)) {
      const name = m[1]
      if (seenAuto.has(name)) continue; seenAuto.add(name)
      const target = composables.get(name) ?? stores.get(name)
      if (target && target !== from) edges.push({ from, to: target, kind: 'auto-import', detail: `${name}()` })
    }
    if (/\bimport\(/.test(src)) unresolved.push({ file: from, spec: 'import()', reason: 'dynamic import not followed' })
    // app.config component contributions: `component: 'Name'` — the root's and every layer's
    if (from.endsWith('app.config.ts')) {
      for (const m of src.matchAll(/component:\s*'([A-Za-z0-9]+)'/g)) {
        const target = components.get(m[1])
        if (target) edges.push({ from, to: target, kind: 'registry', detail: `component: '${m[1]}'` })
        else unresolved.push({ file: from, spec: m[1], reason: 'contributed component not found in components/' })
      }
    }
  }
  for (const e of edges) { e.fromLayer = byRel.get(e.from)?.layer ?? 'EXTERNAL'; e.toLayer = byRel.get(e.to)?.layer ?? 'EXTERNAL' }
  return { files: nodes, edges, unresolved, packageComponents }
}

// ── Non-TypeScript ownership (report only, N0) ───────────────────
// What the import graph cannot see: the root locale messages, the public
// assets, CSS custom properties and font families. Consumers are found by the
// same name-based matching as the auto-import scan (comments stripped), and a
// consumer's layer is its file's layer. Nothing here is forbidden or enforced.
const APP_ROOT = path.dirname(FRONTEND) // the repository root, or a synthetic tree's
const NONTS_SKIP = new Set(['node_modules', '.nuxt', '.output', 'dist'])
function listFiles(dir, keep, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { if (!NONTS_SKIP.has(entry.name)) listFiles(full, keep, out); continue }
    if (keep(entry.name)) out.push(full)
  }
  return out
}
const layersOf = (rels) => [...new Set(rels.map(feLayer))].sort()
const ownerOf = (layers) => (layers.length === 0 ? 'UNREFERENCED' : layers.length === 1 ? layers[0] : 'SHARED')

function scanNonTs() {
  const relOf = (f) => posix(path.relative(FRONTEND, f))
  const code = walk(FRONTEND, ['.ts', '.vue']).map((f) => ({ rel: relOf(f), src: stripComments(fs.readFileSync(f, 'utf8')) }))
  const css = listFiles(FRONTEND, (n) => n.endsWith('.css')).map((f) => ({ rel: relOf(f), src: fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }))
  const nuxtConfig = path.join(APP_ROOT, 'nuxt.config.ts')
  const rootConfig = fs.existsSync(nuxtConfig) ? [{ rel: relOf(nuxtConfig), src: stripComments(fs.readFileSync(nuxtConfig, 'utf8')) }] : []
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Root locale messages: every key, and the layers of the files that use it.
  const i18nDir = path.join(APP_ROOT, 'i18n')
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [p + k]))
  const locales = listFiles(i18nDir, (n) => n.endsWith('.json')).map((f) => ({ file: posix(path.relative(APP_ROOT, f)), keys: flat(JSON.parse(fs.readFileSync(f, 'utf8').trim())) }))
  const allKeys = [...new Set(locales.flatMap((l) => l.keys))].sort()
  const identicalKeySets = locales.every((l) => l.keys.length === allKeys.length)
  // Keys built at runtime (`orders.status_${s}`, 'contact.hours_' + k) count for every key they can produce.
  const dynamic = []
  for (const { rel, src } of code) {
    for (const m of src.matchAll(/`([a-z_]+\.[a-z0-9_.]*)\$\{/g)) dynamic.push({ prefix: m[1], rel })
    for (const m of src.matchAll(/['"]([a-z_]+\.[a-z0-9_.]*)['"]\s*\+/g)) dynamic.push({ prefix: m[1], rel })
  }
  const keyOwner = {}
  for (const key of allKeys) {
    const re = new RegExp(`['"\`]${escape(key)}['"\`]`)
    const users = code.filter(({ src }) => re.test(src)).map(({ rel }) => rel)
    for (const d of dynamic) if (key.startsWith(d.prefix)) users.push(d.rel)
    const layers = layersOf(users)
    keyOwner[key] = layers.length ? layers.join('+') : 'UNREFERENCED'
  }
  const i18n = {
    files: locales.map((l) => l.file), keys: allKeys.length, identicalKeySets,
    byOwner: count(Object.values(keyOwner), (o) => o),
    byNamespace: Object.fromEntries(Object.entries(Object.entries(keyOwner).reduce((acc, [k, o]) => {
      const ns = k.split('.')[0]; (acc[ns] ??= {})[o] = (acc[ns][o] ?? 0) + 1; return acc
    }, {})).sort()),
    dynamicPrefixes: [...new Set(dynamic.map((d) => `${d.prefix}* (${feLayer(d.rel)})`))].sort(),
    keyOwner,
  }

  // Public assets: the URL each file is served at, and who refers to it.
  const publicDir = path.join(APP_ROOT, 'public')
  const publicAssets = listFiles(publicDir, () => true).map((f) => {
    const url = '/' + posix(path.relative(publicDir, f))
    const refs = [...code, ...rootConfig].filter(({ src }) => src.includes(url)).map(({ rel }) => rel)
    const layers = layersOf(refs)
    return { url, owner: ownerOf(layers), layers, refs }
  })

  // CSS custom properties: where each is defined, and who reads it — through
  // var(--x) / [--x] in CSS or templates, or, for @theme tokens, through the
  // Tailwind utility the token generates (`--color-cream` → `bg-cream`).
  const UTIL = '(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|decoration|placeholder|accent|shadow|caret)'
  const defs = new Map() // name → { files, theme }
  for (const { rel, src } of css) {
    const theme = [...src.matchAll(/@theme\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n')
    for (const m of src.matchAll(/(?:^|[{;\s])(--[A-Za-z0-9-]+)\s*:/g)) {
      const d = defs.get(m[1]) ?? { files: new Set(), theme: false }
      d.files.add(rel); if (new RegExp(`(?:^|[{;\\s])${escape(m[1])}\\s*:`).test(theme)) d.theme = true
      defs.set(m[1], d)
    }
  }
  const cssVariables = [...defs.keys()].sort().map((name) => {
    const d = defs.get(name)
    const readRe = new RegExp(`(?:var\\(\\s*|\\[)${escape(name)}(?![A-Za-z0-9-])`)
    const readers = new Set([...css, ...code].filter(({ src }) => readRe.test(src)).map(({ rel }) => rel))
    const util = d.theme && (/^--color-(.+)$/.exec(name)?.[1] ? new RegExp(`\\b${UTIL}-${escape(name.slice(8))}(?![A-Za-z0-9-])`) : /^--font-(.+)$/.test(name) ? new RegExp(`\\bfont-${escape(name.slice(7))}(?![A-Za-z0-9-])`) : null)
    if (util) for (const { rel, src } of code) if (util.test(src)) readers.add(rel)
    const definedIn = [...d.files].sort()
    const readBy = [...readers].sort()
    const external = readBy.filter((r) => !definedIn.includes(r))
    return {
      name, definedIn, theme: d.theme, readBy, readerLayers: layersOf(readBy),
      use: readBy.length === 0 ? 'unread' : external.length ? 'cross-file' : 'local',
    }
  })

  // Font families: loaded by the root config (Google Fonts), named in CSS or code.
  const google = rootConfig.flatMap(({ src }) => [...src.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1].replace(/\+/g, ' ')))
  const named = css.flatMap(({ src }) => [...src.matchAll(/(?:font-family|--font-[\w-]+)\s*:[^;]*/g)].flatMap((m) => [...m[0].matchAll(/['"]([^'"]+)['"]/g)].map((q) => q[1])))
  const fonts = [...new Set([...google, ...named])].sort().map((family) => {
    const refs = [...css, ...code].filter(({ src }) => src.includes(family)).map(({ rel }) => rel)
    return { family, loadedBy: google.includes(family) ? rootConfig.map((c) => c.rel) : [], refs, layers: layersOf(refs) }
  })

  return { i18n, publicAssets, cssVariables, fonts }
}

// ── Graph analysis ───────────────────────────────────────────────
function cycles(nodes, edges) {
  // Tarjan SCC over runtime edges (import, di, auto-*, registry), type edges excluded
  const adj = new Map(nodes.map((n) => [n.file, []]))
  for (const e of edges) if (e.kind !== 'type' && e.kind !== 'prisma' && adj.has(e.from) && adj.has(e.to)) adj.get(e.from).push(e.to)
  let index = 0; const idx = new Map(), low = new Map(), onStack = new Set(), stack = [], out = []
  const strong = (v) => {
    idx.set(v, index); low.set(v, index); index++; stack.push(v); onStack.add(v)
    for (const w of adj.get(v)) {
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))) }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)))
    }
    if (low.get(v) === idx.get(v)) {
      const comp = []; let w
      do { w = stack.pop(); onStack.delete(w); comp.push(w) } while (w !== v)
      if (comp.length > 1) out.push(comp.sort())
    }
  }
  for (const n of nodes) if (!idx.has(n.file)) strong(n.file)
  return out.sort((a, b) => a[0].localeCompare(b[0]))
}
function folderCycles(edges) {
  // unit graph (backend): layer folder + first child — `core/auth`, `modules/ecommerce/orders`,
  // `infrastructure/mail`; the root files are one unit
  const folder = (f) => {
    const parts = f.split('/')
    if (parts.length < 3) return '(root)'
    // `modules/<module>/<file>` (module root files) belong to unit `modules/<module>`
    if (parts[0] === 'modules') return parts.slice(0, parts.length > 3 ? 3 : 2).join('/')
    return parts.slice(0, 2).join('/')
  }
  const pairs = new Set()
  for (const e of edges) if (e.kind !== 'type' && e.kind !== 'prisma') { const a = folder(e.from), b = folder(e.to); if (a !== b) pairs.add(`${a}>${b}`) }
  const out = []
  for (const p of pairs) { const [a, b] = p.split('>'); if (pairs.has(`${b}>${a}`) && a < b) out.push([a, b]) }
  return out.sort()
}
const crossLayer = (edges) => edges.filter((e) => e.fromLayer !== e.toLayer && e.kind !== 'prisma')
const forbidden = (edges, rules) => edges.filter((e) => e.kind !== 'type' && rules.some(([a, b]) => e.fromLayer === a && e.toLayer === b))
const count = (arr, key) => { const m = {}; for (const x of arr) { const k = typeof key === 'function' ? key(x) : x[key]; m[k] = (m[k] ?? 0) + 1 }; return Object.fromEntries(Object.entries(m).sort()) }

// ── Run ──────────────────────────────────────────────────────────
const backend = scanBackend()
const frontend = scanFrontend()
const report = {
  generated_from: { backend: posix(path.relative(REPO, BACKEND)), frontend: posix(path.relative(REPO, FRONTEND)), types: posix(path.relative(REPO, TYPES)) },
  backend: {
    files: backend.files.length, filesByLayer: count(backend.files, 'layer'),
    edges: backend.edges.length, edgesByKind: count(backend.edges, 'kind'),
    crossLayer: count(crossLayer(backend.edges), (e) => `${e.fromLayer}→${e.toLayer}`),
    forbidden: forbidden(backend.edges, FORBIDDEN.backend),
    // type-only edges across a forbidden direction are allowed but listed
    forbiddenTypeOnly: backend.edges.filter((e) => e.kind === 'type' && FORBIDDEN.backend.some(([a, b]) => e.fromLayer === a && e.toLayer === b)),
    shopPrismaFromCore: backend.edges.filter((e) => e.kind === 'prisma' && e.fromLayer === 'CORE' && e.toLayer === 'SHOP'),
    corePrismaFromShop: backend.edges.filter((e) => e.kind === 'prisma' && e.fromLayer === 'SHOP' && e.toLayer === 'CORE').map((e) => `${e.from} → ${e.detail}`),
    fileCycles: cycles(backend.files, backend.edges), folderCycles: folderCycles(backend.edges),
    events: backend.events, configReaders: backend.config, models: backend.models, unresolved: backend.unresolved,
    edgeList: backend.edges,
  },
  frontend: {
    files: frontend.files.length, filesByLayer: count(frontend.files, 'layer'),
    edges: frontend.edges.length, edgesByKind: count(frontend.edges, 'kind'),
    crossLayer: count(crossLayer(frontend.edges), (e) => `${e.fromLayer}→${e.toLayer}`),
    forbidden: forbidden(frontend.edges, FORBIDDEN.frontend),
    coreToShopViaRegistry: frontend.edges.filter((e) => e.kind === 'registry' && e.toLayer === 'SHOP').map((e) => `${e.from} → ${e.to} (${e.detail})`),
    sharedTypeImporters: count(frontend.edges.filter((e) => e.toLayer === 'SHARED'), 'fromLayer'),
    fileCycles: cycles(frontend.files, frontend.edges),
    packageComponentUses: frontend.packageComponents,
    unresolved: frontend.unresolved,
    edgeList: frontend.edges,
    // Report only (N0): ownership the import graph cannot see. Never forbidden.
    nonTs: scanNonTs(),
  },
}

if (flag('--json')) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
} else {
  const fmt = (e) => `  ${e.from} → ${e.to}  [${e.kind}${e.detail ? ' ' + e.detail : ''}]  ${e.fromLayer}→${e.toLayer}`
  console.log(`audit-extraction-readiness — backend ${report.backend.files} files / ${report.backend.edges} edges; frontend ${report.frontend.files} files / ${report.frontend.edges} edges`)
  console.log(`backend files by layer   ${JSON.stringify(report.backend.filesByLayer)}`)
  console.log(`backend edges by kind    ${JSON.stringify(report.backend.edgesByKind)}`)
  console.log(`backend cross-layer      ${JSON.stringify(report.backend.crossLayer)}`)
  console.log(`backend forbidden edges  ${report.backend.forbidden.length}`); report.backend.forbidden.forEach((e) => console.log(fmt(e)))
  console.log(`backend Core→Shop prisma ${report.backend.shopPrismaFromCore.length}; Shop→Core prisma ${report.backend.corePrismaFromShop.length}: ${report.backend.corePrismaFromShop.join(', ')}`)
  console.log(`backend file cycles      ${report.backend.fileCycles.length}`); report.backend.fileCycles.forEach((c) => console.log('  ' + c.join(' ↔ ')))
  console.log(`backend folder cycles    ${report.backend.folderCycles.map((c) => c.join('↔')).join(', ') || 'none'}`)
  console.log(`backend events           publishers ${JSON.stringify(report.backend.events.publishers)} subscribers ${JSON.stringify(report.backend.events.subscribers)}`)
  console.log(`backend config readers   ${report.backend.configReaders.join(', ')}`)
  console.log(`backend unresolved       ${report.backend.unresolved.length}`); report.backend.unresolved.forEach((u) => console.log(`  ${u.file}: ${u.spec} — ${u.reason}`))
  console.log(`frontend files by layer  ${JSON.stringify(report.frontend.filesByLayer)}`)
  console.log(`frontend edges by kind   ${JSON.stringify(report.frontend.edgesByKind)}`)
  console.log(`frontend cross-layer     ${JSON.stringify(report.frontend.crossLayer)}`)
  console.log(`frontend forbidden edges ${report.frontend.forbidden.length}`); report.frontend.forbidden.forEach((e) => console.log(fmt(e)))
  console.log(`frontend Core→Shop via app.config registry ${report.frontend.coreToShopViaRegistry.length}`); report.frontend.coreToShopViaRegistry.forEach((s) => console.log('  ' + s))
  console.log(`frontend types/ importers by layer ${JSON.stringify(report.frontend.sharedTypeImporters)}`)
  console.log(`frontend file cycles     ${report.frontend.fileCycles.length}`); report.frontend.fileCycles.forEach((c) => console.log('  ' + c.join(' ↔ ')))
  console.log(`frontend unresolved      ${report.frontend.unresolved.length}`); report.frontend.unresolved.forEach((u) => console.log(`  ${u.file}: ${u.spec} — ${u.reason}`))
  const n = report.frontend.nonTs
  console.log('frontend non-TypeScript ownership (report only)')
  console.log(`  i18n ${n.i18n.files.join(', ')}: ${n.i18n.keys} keys, identical key sets: ${n.i18n.identicalKeySets ? 'yes' : 'NO'}, by owner ${JSON.stringify(n.i18n.byOwner)}`)
  n.publicAssets.forEach((a) => console.log(`  public ${a.url}  ${a.owner}${a.layers.length > 1 ? ' (' + a.layers.join('+') + ')' : ''}  ← ${a.refs.join(', ') || '(no reference)'}`))
  n.cssVariables.filter((v) => v.use === 'cross-file').forEach((v) => console.log(`  css ${v.name}${v.theme ? ' (@theme)' : ''}  defined ${v.definedIn.join(', ')}  read by ${v.readerLayers.join('+')} (${v.readBy.length} files)`))
  n.fonts.forEach((f) => console.log(`  font ${f.family}  loaded ${f.loadedBy.join(', ') || '(not loaded here)'}  named by ${f.layers.join('+')} (${f.refs.length} files)`))
}

const bad = report.backend.forbidden.length + report.frontend.forbidden.length
if (flag('--strict') && bad) { console.error(`audit-extraction-readiness: ${bad} forbidden cross-layer edge(s)`); process.exit(1) }
