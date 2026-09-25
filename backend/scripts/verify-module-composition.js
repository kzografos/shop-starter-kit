#!/usr/bin/env node
/**
 * Runtime module composition check (E9d2; roadmap C2, F11).
 *
 * The Module Registry claims to decide which application modules run. The other
 * checks prove parts of that chain statically — `verify:modules` pins the
 * generated ids to `modules.json`, `verify-routes` pins the route inventory per
 * owning module — but none of them proves that the composed Nest application
 * actually changes when a module is switched off.
 *
 * This script does, by composing `dist/app.module.js` twice and reading the
 * `ModulesContainer` each time:
 *
 *   enabled   the real registry: every enabled module's declared Nest modules
 *             and controllers must be in the container
 *   disabled  a temporary build artifact that enables nothing: those modules
 *             and controllers must be gone, and everything else untouched
 *
 * Ownership always comes from the declaration site (E9c1/E9d2a) — the classes a
 * module's own `*.module.js` files declare. No class-name heuristic decides
 * anything: `PaymentsModule` is the shop's and `PaymentsProviderModule` is
 * infrastructure, and only the directory separates them.
 *
 * Nothing external is touched: the app is composed (NestFactory.create) but
 * never init()ed, so Prisma never $connects, MinIO never checks its bucket, the
 * permission registry never bootstraps and no HTTP listener starts. Redis is
 * given a lazyConnect URL, as in verify-routes/verify-providers.
 *
 * The disabled state is produced by rewriting the COMPILED `dist/modules.enabled.js`
 * — build output, gitignored — for the duration of one child process. No tracked
 * file is touched: not `modules.json`, not `src/modules.enabled.ts`. The parent
 * restores the exact bytes in a `finally` and on exit, and verifies the hash.
 *
 *   node scripts/verify-module-composition.js
 *   node scripts/verify-module-composition.js --scenario enabled|disabled   (internal: child mode)
 *
 * Requires a prior `nest build`. Runs after `npm run build` in `npm run verify`.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const registry = require('./lib/modules-registry')

const BACKEND = path.resolve(__dirname, '..')
const DIST = path.join(BACKEND, 'dist')
const ENABLED_ARTIFACT = path.join(DIST, 'modules.enabled.js')
const args = process.argv.slice(2)
const scenarioArg = (() => { const i = args.indexOf('--scenario'); return i >= 0 ? args[i + 1] : undefined })()

// Same stub environment as verify-routes/verify-providers: Core keys satisfy
// Joi so the app composes, provider keys are pinned to '' so no SDK client is
// built, and Redis is lazy so no socket opens. Set before requiring dist/.
const STUB_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://verify:verify@127.0.0.1:5432/verify',
  REDIS_URL: 'redis://127.0.0.1:6379/?lazyConnect=true',
  JWT_SECRET: 'verify-only-secret-not-for-use-0123456789ab',
  JWT_REFRESH_SECRET: 'verify-only-refresh-not-for-use-0123456789',
  MINIO_ENDPOINT: '', MINIO_ROOT_USER: '', MINIO_ROOT_PASSWORD: '', MINIO_BUCKET: '', MINIO_PUBLIC_URL: '',
  STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_CALLBACK_URL: '',
  MAIL_TRANSPORT: 'resend', RESEND_API_KEY: '', SMTP_HOST: '',
}

const RESULT_PREFIX = '__composition__ '

// A compiled `modules.enabled.js` that enables nothing — the shape tsc emits for
// an empty registry. Written only into `dist/` (build output, gitignored) and
// only for the duration of the disabled child process.
const DISABLED_ARTIFACT = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enabledModuleIds = void 0;
exports.enabledModuleIds = [];
`

/** Live routes served by the given controllers, from a probe's per-controller totals. */
const countRoutesOf = (facts, controllerNames) =>
  controllerNames.reduce((n, c) => n + (facts.routesByController[c] ?? 0), 0)

// ── Child: compose once and report the facts ────────────────────
// Facts only. Every assertion lives in the parent, so both scenarios are judged
// by the same code against the same registry.
async function probe() {
  const { NestFactory, ModulesContainer } = require('@nestjs/core')
  const { AppModule } = require(path.join(DIST, 'app.module.js'))
  const { enabledModuleIds } = require(path.join(DIST, 'modules.enabled.js'))

  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false })
  const modules = []
  const controllers = []
  const routesByController = {}
  let routes = 0
  for (const mod of app.get(ModulesContainer).values()) {
    if (mod.metatype && mod.metatype.name) modules.push(mod.metatype.name)
    for (const wrapper of mod.controllers.values()) {
      const C = wrapper.metatype
      const instance = wrapper.instance
      if (!C || !instance) continue
      controllers.push(C.name)
      for (const name of methodNamesOf(instance)) {
        if (Reflect.getMetadata('method', instance[name]) === undefined) continue
        routesByController[C.name] = (routesByController[C.name] ?? 0) + 1
        routes++
      }
    }
  }
  await app.close()

  // Corroboration only — the container above is the proof.
  const staticImports = (Reflect.getMetadata('imports', AppModule) ?? [])
    .map((i) => (i && i.module ? i.module.name : i && i.name) || null)
    .filter(Boolean)

  return {
    enabledModuleIds: [...enabledModuleIds],
    modules: modules.sort(),
    controllers: controllers.sort(),
    routes,
    routesByController,
    staticImports: staticImports.sort(),
  }
}

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

if (scenarioArg) {
  Object.assign(process.env, STUB_ENV)
  require('reflect-metadata')
  probe()
    .then((facts) => { process.stdout.write(RESULT_PREFIX + JSON.stringify(facts) + '\n'); process.exit(0) })
    .catch((err) => {
      console.error('verify-module-composition: child failed to compose:', err && err.message ? err.message.split('\n')[0] : err)
      process.exit(1)
    })
  return
}

// ── Parent ──────────────────────────────────────────────────────
const fail = (message, detail = []) => {
  console.error(`verify-module-composition: ${message}`)
  for (const line of detail) console.error('  ' + line)
  process.exit(1)
}

function runScenario(name) {
  const child = spawnSync(process.execPath, [__filename, '--scenario', name], {
    cwd: BACKEND,
    env: { ...process.env, ...STUB_ENV },
    encoding: 'utf8',
  })
  const line = (child.stdout || '').split('\n').find((l) => l.startsWith(RESULT_PREFIX))
  if (child.status !== 0 || !line) {
    fail(`the ${name} scenario did not produce a composition`, [
      `exit code ${child.status}`,
      ...(child.stderr || '').trim().split('\n').filter(Boolean).slice(0, 6),
    ])
  }
  return JSON.parse(line.slice(RESULT_PREFIX.length))
}

const missing = (needed, present) => needed.filter((n) => !present.includes(n))
const found = (needed, present) => needed.filter((n) => present.includes(n))

;(function main() {
  if (!fs.existsSync(path.join(DIST, 'app.module.js')) || !fs.existsSync(ENABLED_ARTIFACT)) {
    console.error('verify-module-composition: dist/ is incomplete — run `npm run build` first')
    process.exit(2)
  }

  // Declaration-site expectations, straight from the registry.
  const declared = registry.readRegistry().map((m) => ({
    id: m.id,
    enabled: Boolean(m.enabled),
    modules: m.backendDir ? registry.declaredModules({ backendDir: m.backendDir }) : [],
    controllers: m.backendDir ? registry.declaredControllers({ backendDir: m.backendDir }) : [],
  }))
  if (!declared.length) fail('modules.json registers no module — nothing to prove')
  const enabledDescriptors = declared.filter((m) => m.enabled)
  if (!enabledDescriptors.length) fail('no registered module is enabled — refusing to pass vacuously')

  // ── 1. enabled: the real registry ─────────────────────────────
  const on = runScenario('enabled')
  if (!on.modules.length || !on.routes) fail('the enabled composition produced no modules or no routes — refusing to pass vacuously')

  for (const m of enabledDescriptors) {
    if (!on.enabledModuleIds.includes(m.id)) {
      fail(`"${m.id}" is enabled in modules.json but missing from the composed enabled-module ids`, [`ids: ${on.enabledModuleIds.join(', ') || 'none'}`])
    }
    if (!m.modules.length) fail(`"${m.id}" declares no Nest module under its backendDir — ownership cannot be proven`)
    const absentModules = missing(m.modules, on.modules)
    if (absentModules.length) fail(`"${m.id}" is enabled but these declared modules are not composed:`, absentModules)
    const absentControllers = missing(m.controllers, on.controllers)
    if (absentControllers.length) fail(`"${m.id}" is enabled but these declared controllers are not composed:`, absentControllers)
  }
  for (const id of on.enabledModuleIds) {
    if (!declared.some((m) => m.id === id && m.enabled)) fail(`the build composes "${id}", which modules.json does not enable`)
  }

  // Everything the enabled modules own, and therefore everything that must
  // disappear when nothing is enabled. Counts are derived, never assumed.
  const ownedModules = [...new Set(enabledDescriptors.flatMap((m) => m.modules))].sort()
  const ownedControllers = [...new Set(enabledDescriptors.flatMap((m) => m.controllers))].sort()
  const ownedRoutes = countRoutesOf(on, ownedControllers)
  const expectedModules = on.modules.filter((n) => !ownedModules.includes(n))
  const expectedControllers = on.controllers.filter((n) => !ownedControllers.includes(n))
  const expectedRoutes = on.routes - ownedRoutes
  if (!ownedRoutes) fail('the enabled modules own no live route — the disabled comparison would prove nothing')

  console.log('verify-module-composition: enabled composition OK')
  console.log(`  registered modules: ${declared.length} (${enabledDescriptors.map((m) => m.id).join(', ')})`)
  console.log(`  composed Nest modules: ${on.modules.length}, of which module-owned: ${ownedModules.length}`)
  console.log(`  module-owned controllers: ${ownedControllers.length}, routes: ${ownedRoutes} of ${on.routes}`)

  // ── 2. disabled: a build artifact that enables nothing ─────────
  const original = fs.readFileSync(ENABLED_ARTIFACT)
  const originalHash = crypto.createHash('sha256').update(original).digest('hex')
  const restore = () => { try { fs.writeFileSync(ENABLED_ARTIFACT, original) } catch { /* nothing better to do while exiting */ } }
  // Belt and braces: `finally` covers the normal and thrown paths, this covers
  // a process that leaves any other way. Restoring twice is harmless.
  process.on('exit', restore)

  let off
  try {
    fs.writeFileSync(ENABLED_ARTIFACT, DISABLED_ARTIFACT)
    off = runScenario('disabled')
  } finally {
    restore()
  }

  const restoredHash = crypto.createHash('sha256').update(fs.readFileSync(ENABLED_ARTIFACT)).digest('hex')
  if (restoredHash !== originalHash) {
    fail('dist/modules.enabled.js was not restored to its original bytes — run `npm run build`', [`expected ${originalHash}`, `found    ${restoredHash}`])
  }

  if (off.enabledModuleIds.length) fail('the disabled scenario still enabled modules', off.enabledModuleIds)
  if (!off.modules.length || !off.routes) fail('the disabled composition produced nothing at all — Core must still compose')

  const leakedModules = found(ownedModules, off.modules)
  if (leakedModules.length) fail('these module classes are still composed with nothing enabled:', leakedModules)
  const leakedControllers = found(ownedControllers, off.controllers)
  if (leakedControllers.length) fail('these module controllers are still composed with nothing enabled:', leakedControllers)

  const lost = missing(expectedModules, off.modules)
  if (lost.length) fail('disabling the registered modules also removed Core/infrastructure modules:', lost)
  const lostControllers = missing(expectedControllers, off.controllers)
  if (lostControllers.length) fail('disabling the registered modules also removed Core/infrastructure controllers:', lostControllers)
  const surprises = off.modules.filter((n) => !expectedModules.includes(n))
  if (surprises.length) fail('the disabled composition contains modules the enabled one did not:', surprises)

  if (off.routes !== expectedRoutes) {
    fail(`disabled route count is ${off.routes}, expected ${expectedRoutes} (${on.routes} live minus the ${ownedRoutes} the registered modules own)`)
  }

  console.log('verify-module-composition: disabled composition OK')
  console.log(`  modules absent: ${enabledDescriptors.map((m) => m.id).join(', ')} (${ownedModules.length} Nest modules, ${ownedControllers.length} controllers)`)
  console.log(`  core/infrastructure preserved: ${off.modules.length} modules, ${off.controllers.length} controllers`)
  console.log(`  routes: ${on.routes} → ${off.routes}`)
  console.log(`  dist/modules.enabled.js restored, sha256 ${originalHash.slice(0, 12)}…`)
  console.log('verify-module-composition: OK — the registry controls Nest composition')
  process.exit(0)
})()

