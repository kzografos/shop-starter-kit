#!/usr/bin/env node
/**
 * Source-tree boundary check (DEPENDENCY-RULES §2–§4, §6.1, §6.4).
 *
 * Encodes the layer map from ARCHITECTURE-BLUEPRINT §2 for the CURRENT flat
 * layout of backend/src and checks four rules by reading source files. It
 * needs no build and no dependencies. It is a stop-gap until the folder move
 * (blueprint Phase 1) lets a real import-graph tool take over.
 *
 * Rules
 *   A  Core and Infrastructure folders must not import from Shop folders;
 *      Infrastructure folders must not import from Core folders either.
 *   B  No *.service.ts may import a *.controller file.
 *   C  Controllers in Core folders must not require Shop capabilities.
 *   D  Services in Core folders must not access Shop Prisma models.
 *   E  `users/` must not import from `auth/` except the guard/decorator
 *      contract every controller uses (auth → users is the allowed direction;
 *      the role values users writes live in users/roles.ts).
 *
 * Baseline
 *   Violations that existed at Architecture Verification Pass 10 are listed in
 *   BASELINE with the blueprint seam that removes them. They do not fail the
 *   check; a NEW violation does. A baseline entry that no longer matches any
 *   file fails the check too, so the list can only shrink.
 *
 *   node scripts/verify-boundaries.js
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const SRC = path.resolve(__dirname, '..', 'src')

// ── Layer map (blueprint §2, current paths) ──────────────────────
const INFRA = ['prisma', 'redis', 'storage', 'payments-provider', 'mail', 'health', 'common']
const CORE = ['core', 'auth', 'users', 'profile', 'staff', 'settings', 'notifications', 'newsletter', 'uploads']
const SHOP = ['products', 'categories', 'favourites', 'orders', 'payments', 'loyalty', 'analytics']
// app.module.ts / main.ts at the root are the composition root and may import everything.

// Capabilities owned by the shop (permissions.ts is itself a documented seam-3
// violation; this list is what rule C checks in Core controllers).
const SHOP_CAPABILITIES = ['view:finance', 'view:orders', 'manage:orders', 'view:catalog', 'manage:catalog', 'manage:inventory']

// Prisma models owned by the shop (blueprint §9).
const SHOP_MODELS = ['order', 'orderItem', 'product', 'category', 'favourite', 'loyaltyTransaction', 'loyaltyAccount']

// ── Baseline: known violations at Pass 10, with the seam that removes them ──
// Format: rule, file (relative to src, forward slashes), detail (must match the finding text exactly)
const BASELINE = [
]

// ── Helpers ──────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(full)
  }
  return out
}
const rel = (file) => path.relative(SRC, file).split(path.sep).join('/')
const topFolder = (relFile) => (relFile.includes('/') ? relFile.split('/')[0] : null)
const layerOf = (folder) => (INFRA.includes(folder) ? 'INFRA' : CORE.includes(folder) ? 'CORE' : SHOP.includes(folder) ? 'SHOP' : folder === null ? 'ROOT' : 'UNMAPPED')

// Resolve a relative import to its top-level folder under src.
function importFolder(fromRel, spec) {
  if (!spec.startsWith('.')) return null // package import
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec))
  if (resolved.startsWith('..')) return null
  return resolved.includes('/') ? resolved.split('/')[0] : null
}

// ── Scan ─────────────────────────────────────────────────────────
const findings = [] // { rule, file, detail, message }
const unmapped = new Set()

for (const file of walk(SRC)) {
  const r = rel(file)
  const folder = topFolder(r)
  const layer = layerOf(folder)
  if (layer === 'UNMAPPED') unmapped.add(folder)
  const src = fs.readFileSync(file, 'utf8')
  const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])

  // Rule A: Core/Infra → Shop imports
  if (layer === 'CORE' || layer === 'INFRA') {
    for (const spec of imports) {
      const target = importFolder(r, spec)
      if (target && SHOP.includes(target)) {
        findings.push({ rule: 'A', file: r, detail: target, message: `${layer} file imports shop folder '${target}' (${spec})` })
      }
      if (layer === 'INFRA' && target && CORE.includes(target)) {
        findings.push({ rule: 'A', file: r, detail: target, message: `Infrastructure file imports Core folder '${target}' (${spec}); Infrastructure must stay Core-free` })
      }
    }
  }

  // Rule B: services importing controllers
  if (r.endsWith('.service.ts')) {
    for (const spec of imports) {
      if (/\.controller$/.test(spec)) {
        findings.push({ rule: 'B', file: r, detail: spec, message: `service imports a controller (${spec})` })
      }
    }
  }

  // Rule C: Core controllers using shop capabilities
  if (layer === 'CORE' && r.endsWith('.controller.ts')) {
    for (const m of src.matchAll(/RequirePermissions\(([^)]*)\)/g)) {
      for (const cap of SHOP_CAPABILITIES) {
        if (m[1].includes(`'${cap}'`)) {
          findings.push({ rule: 'C', file: r, detail: cap, message: `Core controller requires shop capability '${cap}'` })
        }
      }
    }
  }

  // Rule E: users → auth only through the cross-cutting guard/decorator contract
  if (folder === 'users') {
    for (const spec of imports) {
      if (importFolder(r, spec) === 'auth' && !/\/auth\/(guards|decorators)\//.test(spec)) {
        findings.push({ rule: 'E', file: r, detail: spec, message: `users/ imports auth at runtime (${spec}); auth depends on users, not the reverse` })
      }
    }
  }

  // Rule D: Core services touching shop Prisma models
  if (layer === 'CORE' && r.endsWith('.service.ts')) {
    const seen = new Set()
    for (const m of src.matchAll(/\b(?:prisma|tx)\.([a-zA-Z]+)\b/g)) {
      const model = m[1]
      if (SHOP_MODELS.includes(model) && !seen.has(model)) {
        seen.add(model)
        findings.push({ rule: 'D', file: r, detail: model, message: `Core service accesses shop Prisma model '${model}'` })
      }
    }
  }
}

// ── Reconcile with baseline ──────────────────────────────────────
const key = (f) => `${f.rule}|${f.file}|${f.detail}`
const baselineKeys = new Map(BASELINE.map((b) => [key(b), b]))
const matchedBaseline = new Set()
const fresh = []

for (const f of findings) {
  const k = key(f)
  if (baselineKeys.has(k)) matchedBaseline.add(k)
  else fresh.push(f)
}
const stale = BASELINE.filter((b) => !matchedBaseline.has(key(b)))

// ── Report ───────────────────────────────────────────────────────
let exit = 0

if (unmapped.size) {
  console.error('verify-boundaries: folders not in the layer map (add them to INFRA/CORE/SHOP in this script):\n  ' + [...unmapped].sort().join('\n  '))
  exit = 1
}
if (fresh.length) {
  console.error('verify-boundaries: NEW boundary violations:')
  for (const f of fresh) console.error(`  [${f.rule}] ${f.file}: ${f.message}`)
  exit = 1
}
if (stale.length) {
  console.error('verify-boundaries: baseline entries that no longer match (remove them from BASELINE):')
  for (const b of stale) console.error(`  [${b.rule}] ${b.file}: ${b.detail}  (${b.seam})`)
  exit = 1
}
if (exit === 0) {
  console.log(`verify-boundaries: OK — no new violations; ${matchedBaseline.size} known violation(s) tracked against blueprint seams:`)
  for (const b of BASELINE) console.log(`  [${b.rule}] ${b.file}: ${b.detail}  → ${b.seam}`)
}
process.exit(exit)
