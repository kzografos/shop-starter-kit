#!/usr/bin/env node
/**
 * Route inventory check (DEPENDENCY-RULES §10, blueprint §12).
 *
 * Instantiates the Nest dependency graph from `dist/` WITHOUT calling init()
 * (no database, Redis, storage or mail connection is made), enumerates every
 * controller route with its guards and required capabilities, and compares the
 * sorted result with the snapshots.
 *
 * The inventory is **partitioned by owning module** (E9c2): one snapshot holds
 * the Core/root routes, and each registered module has its own. Ownership comes
 * from the Module Registry's declaration-site helper — never from URL prefixes,
 * never from `imports` — so a module's routes are exactly the routes of the
 * controllers its own Nest modules declare:
 *
 *   scripts/route-inventory.snapshot.txt          Core + infrastructure/root
 *   scripts/route-snapshots/<module-id>.snapshot.txt   one registered module
 *
 * Together they are the whole live inventory; every route belongs to exactly
 * one of them.
 *
 *   node scripts/verify-routes.js             compare with the snapshots (exit 1 on drift)
 *   node scripts/verify-routes.js --update    rewrite every partition's snapshot
 *   node scripts/verify-routes.js --print     print the whole inventory only
 *   node scripts/verify-routes.js --snapshot <file>   single-file mode (see below)
 *   node scripts/verify-routes.js --registry <file>   read another modules.json
 *
 * `--snapshot <file>` keeps its pre-partition meaning: the *complete* inventory
 * is compared with (or written to) that one file, partitioning aside. It is for
 * ad-hoc and manual use — a throw-away capture of the full route list — and the
 * normal verification path never uses it.
 *
 * `--registry <file>` exists so the composition invariants below can be
 * exercised against a scratch registry without touching the real one.
 *
 * Requires a prior `nest build`. Runs after `npm run build` in `npm run verify`.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const registry = require('./lib/modules-registry')

const BACKEND = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const UPDATE = args.includes('--update')
const PRINT = args.includes('--print')
const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined }
const singleArg = valueOf('--snapshot')
const SINGLE = singleArg ? path.resolve(singleArg) : null
const REGISTRY = valueOf('--registry') ? path.resolve(valueOf('--registry')) : registry.DEFAULTS.registry
const CORE_SNAPSHOT = path.join(__dirname, 'route-inventory.snapshot.txt')
const SNAPSHOT_DIR = path.join(__dirname, 'route-snapshots')

/**
 * A module's snapshot path, derived from its id — the registry deliberately
 * carries no snapshot path of its own. The id is restricted to the shape a
 * module id already has so it can only ever name a file inside SNAPSHOT_DIR.
 */
function moduleSnapshot(id) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) {
    console.error(`verify-routes: module id "${id}" is not a usable snapshot name`)
    process.exit(2)
  }
  return path.join(SNAPSHOT_DIR, `${id}.snapshot.txt`)
}

// ── Environment stubs ───────────────────────────────────────────
// Core keys satisfy Joi so the app composes; provider keys are pinned to ''
// so no SDK client is constructed (see core/config/env.validation.ts).
// Set BEFORE requiring dist/: @prisma/client dotenv-loads backend/.env at
// require time (it never overrides existing keys), and ConfigModule merges
// process.env over the .env file, so these values win in every environment.
const STUB_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://verify:verify@127.0.0.1:5432/verify',
  REDIS_URL: 'redis://127.0.0.1:6379/?lazyConnect=true', // lazyConnect: no socket opened
  JWT_SECRET: 'verify-only-secret-not-for-use-0123456789ab',
  JWT_REFRESH_SECRET: 'verify-only-refresh-not-for-use-0123456789',
  MINIO_ENDPOINT: '', MINIO_ROOT_USER: '', MINIO_ROOT_PASSWORD: '', MINIO_BUCKET: '', MINIO_PUBLIC_URL: '',
  STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_CALLBACK_URL: '',
  MAIL_TRANSPORT: 'resend', RESEND_API_KEY: '', SMTP_HOST: '',
}
Object.assign(process.env, STUB_ENV)

const DIST = path.join(BACKEND, 'dist')
if (!fs.existsSync(path.join(DIST, 'app.module.js'))) {
  console.error('verify-routes: dist/app.module.js not found — run `npm run build` first')
  process.exit(2)
}

// ── Nest metadata keys ──────────────────────────────────────────
// These are the metadata keys Nest's decorators write. They are the documented
// values of PATH_METADATA / METHOD_METADATA / GUARDS_METADATA and have been
// stable since Nest 8; using the literals avoids importing the internal
// `@nestjs/common/constants` path. If Nest ever renames them the scan finds
// zero routes and the script fails loudly rather than passing vacuously.
const META = { path: 'path', method: 'method', guards: '__guards__' }

const { NestFactory, Reflector, ModulesContainer } = require('@nestjs/core')
const { RequestMethod } = require('@nestjs/common')
const { AppModule } = require(path.join(DIST, 'app.module.js'))
const { PERMISSIONS_KEY } = require(path.join(DIST, 'core/auth/decorators/permissions.decorator.js'))

const methodName = (m) => RequestMethod[m] ?? `METHOD_${m}`

function methodNamesOf(instance) {
  const names = new Set()
  let proto = Object.getPrototypeOf(instance)
  while (proto && proto !== Object.prototype) {
    for (const n of Object.getOwnPropertyNames(proto)) {
      if (n === 'constructor') continue
      const d = Object.getOwnPropertyDescriptor(proto, n)
      if (d && typeof d.value === 'function') names.add(n)
    }
    proto = Object.getPrototypeOf(proto)
  }
  return [...names]
}

function joinPath(base, sub) {
  const p = `/${base ?? ''}/${sub ?? ''}`.replace(/\/+/g, '/').replace(/\/$/, '')
  return p || '/'
}

async function inventory() {
  // create() resolves every provider and controller; lifecycle hooks (Prisma
  // $connect, MinIO bucket check) only run on init()/listen(), never here.
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false })
  const modules = app.get(ModulesContainer)
  const reflector = new Reflector()
  const rows = []

  for (const mod of modules.values()) {
    for (const wrapper of mod.controllers.values()) {
      const C = wrapper.metatype
      const inst = wrapper.instance
      if (!C || !inst) continue
      const basePath = Reflect.getMetadata(META.path, C)
      const classGuards = (Reflect.getMetadata(META.guards, C) ?? []).map((g) => g.name)
      for (const name of methodNamesOf(inst)) {
        const handler = inst[name]
        const method = Reflect.getMetadata(META.method, handler)
        if (method === undefined) continue // not a route handler
        const subPath = Reflect.getMetadata(META.path, handler)
        const methodGuards = (Reflect.getMetadata(META.guards, handler) ?? []).map((g) => g.name)
        const caps = reflector.getAllAndOverride(PERMISSIONS_KEY, [handler, C]) ?? null
        rows.push({
          method: methodName(method),
          path: joinPath(basePath, subPath),
          controller: C.name,
          guards: [...classGuards, ...methodGuards],
          caps,
        })
      }
    }
  }
  await app.close()
  return rows
}

function format(rows) {
  return rows
    .map((r) => `${r.method.padEnd(6)} ${r.path.padEnd(40)} ${r.controller.padEnd(26)} guards=[${r.guards.join(',')}] caps=${JSON.stringify(r.caps)}`)
    .sort()
}

// Tolerate a UTF-8 BOM and CRLF from Windows editors/shells.
const normalize = (text) => text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '')

/** The controller a formatted line belongs to (third column of `format()`). */
const controllerOf = (line) => line.trim().split(/\s+/)[2]

/**
 * Declaration-site ownership for every registered module (E9c1): one partition
 * per module, plus the controller → module-id map behind it.
 *
 * No module id appears in this file. A second registered module gets its
 * partition and its snapshot from the registry, with no change here.
 */
function ownership() {
  const modules = registry.readRegistry(REGISTRY).filter((m) => m.backendDir)
  const owner = new Map() // controller name → module id
  const conflicts = []
  const partitions = modules.map((m) => {
    const controllers = registry.declaredControllers({ registryPath: REGISTRY, backendDir: m.backendDir })
    for (const c of controllers) {
      if (owner.has(c) && owner.get(c) !== m.id) conflicts.push(`${c}  (${owner.get(c)} and ${m.id})`)
      else owner.set(c, m.id)
    }
    return { id: m.id, enabled: Boolean(m.enabled), controllers, rows: [] }
  })
  if (conflicts.length) {
    console.error('verify-routes: controllers claimed by more than one module:\n  ' + conflicts.join('\n  '))
    process.exit(1)
  }
  return { partitions, owner }
}

/**
 * Compare one partition with its snapshot. Returns true when they match.
 *
 * With an ownership map the lines are checked against the partition they sit in
 * first, so a route that was moved into the wrong snapshot reports as exactly
 * that rather than as a pair of unrelated drift entries.
 */
function compare(label, file, actual, owner, expectedId) {
  const where = path.relative(BACKEND, file)
  if (!fs.existsSync(file)) {
    console.error(`verify-routes: ${label}: snapshot not found at ${where} — run with --update to create it`)
    return false
  }
  const expected = normalize(fs.readFileSync(file, 'utf8')).split('\n').filter((l) => l.length)

  if (owner) {
    // `undefined` is the core partition: a controller no module declares.
    const misplaced = expected.filter((l) => owner.get(controllerOf(l)) !== expectedId)
    if (misplaced.length) {
      console.error(`verify-routes: ${label}: ${where} lists routes owned by another partition:`)
      for (const l of misplaced) console.error(`  ${l}  → ${owner.get(controllerOf(l)) ?? 'core'}`)
      return false
    }
  }

  const exp = new Set(expected)
  const act = new Set(actual)
  const removed = expected.filter((l) => !act.has(l))
  const added = actual.filter((l) => !exp.has(l))
  if (removed.length || added.length) {
    console.error(`verify-routes: ${label}: inventory drift (${actual.length} routes now, ${expected.length} in ${where})`)
    for (const l of removed) console.error('  - ' + l)
    for (const l of added) console.error('  + ' + l)
    return false
  }
  return true
}

;(async () => {
  const rows = await inventory()
  if (rows.length === 0) {
    console.error('verify-routes: discovered 0 routes — Nest metadata keys may have changed; refusing to pass vacuously')
    process.exit(1)
  }

  // Duplicate method+path across ALL controllers: Nest registers both and the
  // first wins silently, which is exactly the transition bug the admin
  // extraction had to avoid.
  const seen = new Map()
  const dupes = []
  for (const r of rows) {
    const key = `${r.method} ${r.path}`
    if (seen.has(key)) dupes.push(`${key}  (${seen.get(key)} and ${r.controller})`)
    else seen.set(key, r.controller)
  }
  if (dupes.length) {
    console.error('verify-routes: duplicate routes:\n  ' + dupes.join('\n  '))
    process.exit(1)
  }

  const lines = format(rows)
  const current = lines.join('\n') + '\n'

  if (PRINT) {
    process.stdout.write(current)
    process.exit(0)
  }

  // Single-file mode: the whole inventory in one file, as before E9c2.
  if (SINGLE) {
    if (UPDATE) {
      fs.writeFileSync(SINGLE, current, 'utf8')
      console.log(`verify-routes: wrote ${lines.length} routes to ${path.relative(BACKEND, SINGLE)}`)
      process.exit(0)
    }
    if (!compare(path.relative(BACKEND, SINGLE), SINGLE, lines)) process.exit(1)
    console.log(`verify-routes: OK — ${lines.length} routes match ${path.relative(BACKEND, SINGLE)}, no duplicates`)
    process.exit(0)
  }

  // ── Ownership partitioning ────────────────────────────────────
  const { partitions, owner } = ownership()
  const core = []
  for (const r of rows) {
    const id = owner.get(r.controller)
    if (id === undefined) core.push(r)
    else partitions.find((p) => p.id === id).rows.push(r)
  }

  // Composition invariants. An enabled module that declares controllers must
  // serve them: no live route means it is registered, switched on, and composed
  // by nobody. A disabled module must serve none: a live route from it means the
  // switch does not actually remove it.
  const broken = []
  for (const p of partitions) {
    if (p.enabled && p.controllers.length && p.rows.length === 0) {
      broken.push(`module "${p.id}" is enabled and declares ${p.controllers.length} controller(s) but owns no live route`)
    }
    if (!p.enabled && p.rows.length) {
      broken.push(`module "${p.id}" is disabled but owns ${p.rows.length} live route(s), e.g. ${p.rows[0].method} ${p.rows[0].path}`)
    }
  }
  if (broken.length) {
    console.error('verify-routes: module composition mismatch:\n  ' + broken.join('\n  '))
    process.exit(1)
  }

  const targets = [{ label: 'core', file: CORE_SNAPSHOT, id: undefined, rows: core }]
  for (const p of partitions) targets.push({ label: p.id, file: moduleSnapshot(p.id), id: p.id, rows: p.rows })

  if (UPDATE) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
    for (const t of targets) {
      // A module with no live routes gets no snapshot file: there is nothing to
      // pin, and an empty file would read as "verified".
      if (t.id !== undefined && t.rows.length === 0) {
        console.log(`verify-routes: ${t.label} owns no live route — no snapshot written`)
        continue
      }
      const text = format(t.rows).join('\n') + '\n'
      fs.writeFileSync(t.file, text, 'utf8')
      console.log(`verify-routes: wrote ${t.rows.length} routes to ${path.relative(BACKEND, t.file)}`)
    }
    process.exit(0)
  }

  let ok = true
  const summary = []
  for (const t of targets) {
    // Fail closed: a module that serves routes without a snapshot is unverified,
    // and a missing file must never be read as an empty expectation.
    if (t.id !== undefined && t.rows.length === 0 && !fs.existsSync(t.file)) {
      summary.push(`${t.label} 0`)
      continue
    }
    ok = compare(t.label, t.file, format(t.rows), owner, t.id) && ok
    summary.push(`${t.label} ${t.rows.length}`)
  }
  if (!ok) {
    console.error('If intentional, review the diff and run: npm run verify:routes:update')
    process.exit(1)
  }
  console.log(`verify-routes: OK — ${rows.length} routes match the snapshots (${summary.join(', ')}), no duplicates`)
  process.exit(0)
})().catch((err) => {
  console.error('verify-routes: failed to compose the application:', err && err.message ? err.message.split('\n')[0] : err)
  process.exit(1)
})
