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
 *   frontend relative + `~/`, `~~/`, `@/`, `@@/` imports (runtime vs type),
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
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

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
const BE_CORE = ['core', 'auth', 'users', 'profile', 'staff', 'settings', 'notifications', 'newsletter', 'uploads']
const BE_SHOP = ['products', 'categories', 'favourites', 'orders', 'payments', 'loyalty', 'analytics']
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
const FE_SHOP_PREFIXES = [
  'components/cart/', 'components/checkout/', 'components/filters/', 'components/loyalty/', 'components/product/',
  'pages/products/', 'pages/checkout/', 'pages/account/orders/', 'pages/admin/analytics/', 'pages/admin/products/',
  'pages/admin/categories/', 'pages/admin/orders/',
]
const FE_SHOP_FILES = [
  'components/account/AccountStats.global.vue', 'components/admin/ProductDrawer.vue', 'components/BrandsMarquee.vue',
  'pages/account/loyalty.vue', 'pages/account/favourites.vue', 'pages/admin/index.vue', 'pages/brands.vue',
  'stores/cart.ts', 'stores/favourites.ts', 'stores/filters.ts',
  'composables/useProducts.ts', 'composables/useCartDrawer.ts', 'composables/useOrderPresentation.ts',
  'composables/useCurrency.ts', 'composables/useLoyalty.ts',
  'utils/loyalty.ts', 'utils/order-notification-presenter.ts', 'plugins/order-notifications.ts',
]
const FE_PROJECT_FILES = [
  'components/BrandLockup.vue', 'components/BrandWordmark.vue', 'components/layout/WhatsAppButton.vue',
  'composables/useBusinessSchema.ts', 'composables/useOpeningHours.ts', 'utils/business.ts',
  'pages/about.vue', 'pages/contact.vue', 'pages/index.vue', 'app.config.ts',
]
const feLayer = (rel) => {
  if (rel.startsWith('types/')) return 'SHARED' // ../types/index.ts — mixed contracts, see the doc
  if (FE_SHOP_FILES.includes(rel) || FE_SHOP_PREFIXES.some((p) => rel.startsWith(p))) return 'SHOP'
  if (FE_PROJECT_FILES.includes(rel)) return 'PROJECT'
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
  // Nuxt auto-import tables
  const components = new Map() // Name → rel file
  for (const f of appFiles) {
    const r = rel(f)
    if (r.startsWith('components/') && r.endsWith('.vue')) components.set(path.basename(r).replace(/\.global\.vue$|\.vue$/, ''), r)
  }
  const composables = new Map(), stores = new Map()
  for (const f of appFiles) {
    const r = rel(f)
    if (r.startsWith('composables/')) composables.set(stripExt(path.basename(r)), r)
    if (r.startsWith('stores/')) stores.set('use' + path.basename(stripExt(r))[0].toUpperCase() + path.basename(stripExt(r)).slice(1) + 'Store', r)
  }
  const aliasRoot = (spec) => {
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
    // app.config component contributions: `component: 'Name'`
    if (from === 'app.config.ts') {
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
  // top-level folder graph (backend) — the extraction unit
  const folder = (f) => (f.includes('/') ? f.split('/')[0] : '(root)')
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
}

const bad = report.backend.forbidden.length + report.frontend.forbidden.length
if (flag('--strict') && bad) { console.error(`audit-extraction-readiness: ${bad} forbidden cross-layer edge(s)`); process.exit(1) }
