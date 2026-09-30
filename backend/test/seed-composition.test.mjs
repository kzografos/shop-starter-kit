// Seed composition (E9e5). Runs the compiled seed root against a recording fake
// client — no database — and pins which seeds run for which enabled-module
// list. Module-owned models are derived from the registry, so the Core-only
// cases do not hard-code the shop's model names.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { runSeed } = require('../dist/seed.js')
const { enabledModuleIds } = require('../dist/modules.enabled.js')
const registry = require('../scripts/lib/modules-registry.js')

// A client that records every call. Delegates listed in `forbidden` throw on
// ANY access, so "never touched" is enforced, not inferred from a count.
const fakeClient = ({ admins = 0, forbidden = [] } = {}) => {
  const calls = []
  const client = new Proxy({}, {
    get(_t, model) {
      if (typeof model !== 'string' || model === 'then') return undefined
      if (forbidden.includes(model)) throw new Error(`seed touched forbidden model '${model}'`)
      return new Proxy({}, {
        get(_d, op) {
          return async (args) => {
            calls.push({ model, op, args })
            if (model === 'user' && op === 'count') return admins
            if (op === 'upsert') return { id: `id-of-${args.where.slug ?? args.where.email}` }
            return null
          }
        },
      })
    },
  })
  return { client, calls }
}
const quietly = async (fn) => {
  const saved = { log: console.log, warn: console.warn }
  console.log = console.warn = () => {}
  try { return await fn() } finally { Object.assign(console, saved) }
}
const DEMO = { SEED_DEMO_DATA: 'true' }
const moduleDelegates = registry.moduleModels()

test('enabled module: Core seed, then 10 categories, then 10 products linked to them', async () => {
  const { client, calls } = fakeClient()
  await quietly(() => runSeed(client, { env: DEMO, modules: ['ecommerce'] }))

  const sequence = calls.map((c) => c.model)
  const firstCategory = sequence.indexOf('category')
  assert.ok(sequence.slice(0, firstCategory).every((m) => m === 'user'), 'Core runs before the module seed')
  const categories = calls.filter((c) => c.model === 'category')
  const products = calls.filter((c) => c.model === 'product')
  assert.deepEqual(categories.map((c) => c.args.where.slug), Array.from({ length: 10 }, (_, i) => `category-${i + 1}`))
  assert.deepEqual(products.map((c) => c.args.where.slug), Array.from({ length: 10 }, (_, i) => `sample-product-${i + 1}`))
  assert.ok(sequence.lastIndexOf('category') < sequence.indexOf('product'), 'every category precedes every product')
  products.forEach((p, i) => assert.equal(p.args.create.categoryId, `id-of-category-${i + 1}`))
  assert.ok([...categories, ...products].every((c) => c.op === 'upsert' && Object.keys(c.args.update).length === 0),
    'catalogue writes are create-only upserts')
})

test('registered but disabled module: its seed never runs', async () => {
  const { client, calls } = fakeClient({ forbidden: moduleDelegates })
  await quietly(() => runSeed(client, { env: DEMO, modules: [] }))
  assert.equal(calls.filter((c) => c.model === 'user' && c.op === 'upsert').length, 2, 'Core demo users still seeded')
})

test('Core only: owner bootstrap and demo users succeed with every module model forbidden', async () => {
  assert.ok(moduleDelegates.length > 0, 'the registry names module models to forbid')
  const { client, calls } = fakeClient({ forbidden: moduleDelegates })
  await quietly(() => runSeed(client, {
    env: { ...DEMO, OWNER_EMAIL: 'owner@example.com', OWNER_PASSWORD: 'correct-horse-battery' },
    modules: [],
  }))
  const upserts = calls.filter((c) => c.op === 'upsert').map((c) => c.args.where.email)
  assert.deepEqual(upserts, ['owner@example.com', 'admin@demo.com', 'user@demo.com'])
})

test('demo data off: an enabled module seeds nothing', async () => {
  const { client, calls } = fakeClient({ forbidden: moduleDelegates })
  await quietly(() => runSeed(client, { env: {}, modules: ['ecommerce'] }))
  assert.deepEqual(calls.map((c) => `${c.model}.${c.op}`), ['user.count'])
})

test('by default the seed follows the generated enabled-module ids', async () => {
  const explicit = fakeClient()
  await quietly(() => runSeed(explicit.client, { env: DEMO, modules: enabledModuleIds }))
  const implicit = fakeClient()
  await quietly(() => runSeed(implicit.client, { env: DEMO }))
  assert.deepEqual(implicit.calls.map((c) => `${c.model}.${c.op}`), explicit.calls.map((c) => `${c.model}.${c.op}`))
})

test('no fallback to the old monolithic seed', () => {
  assert.equal(existsSync(path.join(BACKEND, 'prisma', 'seed.ts')), false, 'prisma/seed.ts is gone')
  assert.equal(typeof runSeed, 'function', 'dist/seed.js exports runSeed')
  const scripts = JSON.parse(readFileSync(path.join(BACKEND, 'package.json'), 'utf8')).scripts
  const seedScripts = Object.entries(scripts).filter(([name]) => /seed/.test(name))
  assert.ok(seedScripts.length > 0 && seedScripts.every(([, cmd]) => cmd.includes('src/seed.ts')), JSON.stringify(seedScripts))
  assert.ok(!readFileSync(path.join(BACKEND, 'Dockerfile'), 'utf8').includes('prisma/seed'), 'Dockerfile no longer compiles prisma/seed.ts')
  assert.ok(readFileSync(path.join(BACKEND, 'start.sh'), 'utf8').includes('node dist/seed.js'), 'start.sh still runs dist/seed.js')
})
