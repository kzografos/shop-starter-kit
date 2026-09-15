#!/usr/bin/env node
/**
 * Route inventory check (DEPENDENCY-RULES §10, blueprint §12).
 *
 * Instantiates the Nest dependency graph from `dist/` WITHOUT calling init()
 * (no database, Redis, storage or mail connection is made), enumerates every
 * controller route with its guards and required capabilities, and compares the
 * sorted result with `scripts/route-inventory.snapshot.txt`.
 *
 *   node scripts/verify-routes.js             compare with the snapshot (exit 1 on drift)
 *   node scripts/verify-routes.js --update    write the current inventory as the snapshot
 *   node scripts/verify-routes.js --print     print the inventory only
 *   node scripts/verify-routes.js --snapshot <file>   compare with / update another file
 *
 * Requires a prior `nest build`. Runs after `npm run build` in `npm run verify`.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const BACKEND = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const UPDATE = args.includes('--update')
const PRINT = args.includes('--print')
const snapArg = args.indexOf('--snapshot')
const SNAPSHOT = snapArg >= 0 ? path.resolve(args[snapArg + 1]) : path.join(__dirname, 'route-inventory.snapshot.txt')

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
const { PERMISSIONS_KEY } = require(path.join(DIST, 'auth/decorators/permissions.decorator.js'))

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
  if (UPDATE) {
    fs.writeFileSync(SNAPSHOT, current, 'utf8')
    console.log(`verify-routes: wrote ${lines.length} routes to ${path.relative(BACKEND, SNAPSHOT)}`)
    process.exit(0)
  }
  if (!fs.existsSync(SNAPSHOT)) {
    console.error(`verify-routes: snapshot not found at ${path.relative(BACKEND, SNAPSHOT)} — run with --update to create it`)
    process.exit(2)
  }

  const expected = normalize(fs.readFileSync(SNAPSHOT, 'utf8')).split('\n')
  const actual = normalize(current).split('\n')
  const exp = new Set(expected)
  const act = new Set(actual)
  const removed = expected.filter((l) => !act.has(l))
  const added = actual.filter((l) => !exp.has(l))

  if (removed.length || added.length) {
    console.error(`verify-routes: inventory drift (${actual.length} routes now, ${expected.length} in snapshot)`)
    for (const l of removed) console.error('  - ' + l)
    for (const l of added) console.error('  + ' + l)
    console.error('If intentional, review the diff and run: npm run verify:routes:update')
    process.exit(1)
  }
  console.log(`verify-routes: OK — ${actual.length} routes match the snapshot, no duplicates`)
  process.exit(0)
})().catch((err) => {
  console.error('verify-routes: failed to compose the application:', err && err.message ? err.message.split('\n')[0] : err)
  process.exit(1)
})
