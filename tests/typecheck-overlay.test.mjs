// The typecheck overlay (scripts/typecheck.mjs): the generated .nuxt/tsconfig.json
// excludes, verbatim, plus one glob per module layer modules.json disables —
// and nothing wider. Pure: a fixture root, no file system, no Nuxt.
import { typecheckOverlay } from '../scripts/typecheck.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

const root = path.resolve('/fixture-repo')
const existing = new Set(['app/modules/ecommerce', 'app/modules/blog', 'app/modules/booking'].map((d) => path.resolve(root, d)))
const isDirectory = (dir) => existing.has(dir)
const base = { compilerOptions: { strict: true }, include: ['../app/**/*'], exclude: ['../node_modules', '../dist', '../.data'] }

const mod = (id, enabled, nuxtLayer = `./app/modules/${id}`) => ({ id, enabled, nuxtLayer, backendDir: `modules/${id}` })
const overlay = (modules, b = base) => typecheckOverlay({ base: b, registry: { modules }, root, isDirectory })
const ECOMMERCE = '../app/modules/ecommerce/**/*'

test('a disabled module layer is excluded, as a glob relative to .nuxt', () => {
  const { overlay: o, excluded } = overlay([mod('ecommerce', false)])
  assert.deepEqual(excluded, [ECOMMERCE])
  assert.deepEqual(o, { extends: './tsconfig.json', exclude: [...base.exclude, ECOMMERCE] })
})

test('enabled modules are not excluded; with none disabled the overlay is the generated config', () => {
  const { overlay: o, excluded } = overlay([mod('ecommerce', true), mod('blog', true)])
  assert.deepEqual(excluded, [])
  assert.deepEqual(o.exclude, base.exclude)

  const mixed = overlay([mod('ecommerce', false), mod('blog', true)])
  assert.deepEqual(mixed.excluded, [ECOMMERCE])
  assert.ok(!mixed.overlay.exclude.some((g) => g.includes('/blog')))
})

test('Core, the project and the app root are never excluded', () => {
  const { overlay: o } = overlay([mod('ecommerce', false), mod('blog', false)])
  for (const glob of o.exclude.slice(base.exclude.length)) {
    assert.match(glob, /^\.\.\/app\/modules\/[a-z]+\/\*\*\/\*$/)
  }
  // Not even when modules.json names them as a module's layer.
  for (const layer of ['./app/core', './app/project', './app/core/components', './app']) {
    assert.throws(() => overlay([mod('x', false, layer)]), /stays composed|not a directory inside app\//, layer)
  }
})

test('the generated excludes are preserved exactly, in order, and the base is not mutated', () => {
  const generated = { exclude: ['../node_modules', '../app/core/node_modules', '../layers/*/server/**/*', '../dist'] }
  const snapshot = structuredClone(generated)
  const { overlay: o } = overlay([mod('ecommerce', false)], generated)
  assert.deepEqual(o.exclude.slice(0, generated.exclude.length), snapshot.exclude)
  assert.deepEqual(generated, snapshot)
})

test('several disabled modules: one glob each, in registry order, each once', () => {
  const { excluded } = overlay([mod('ecommerce', false), mod('blog', true), mod('booking', false), mod('shop-copy', false, './app/modules/ecommerce/')])
  assert.deepEqual(excluded, [ECOMMERCE, '../app/modules/booking/**/*'])
})

test('a disabled module without a usable nuxtLayer fails', () => {
  for (const nuxtLayer of [undefined, null, '', '   ', 42]) {
    assert.throws(() => overlay([{ id: 'ecommerce', enabled: false, nuxtLayer }]), /has no `nuxtLayer`/, String(nuxtLayer))
  }
  assert.throws(() => overlay([mod('ghost', false)]), /does not exist/)
  assert.throws(() => overlay([mod('x', false, './app/modules/*')]), /glob characters/)
})

test('a layer outside app/ fails, however it is spelled', () => {
  for (const layer of ['./backend/src', '../elsewhere', './app/../backend', path.resolve('/somewhere/else'), '.', './application']) {
    assert.throws(() => overlay([mod('x', false, layer)]), /not a directory inside app\//, layer)
  }
})

test('a disabled layer that contains an enabled one fails', () => {
  assert.throws(() => overlay([mod('blog', true), mod('all', false, './app/modules')]), /overlaps app[\\/]modules[\\/]blog/)
})

test('a generated config without an exclude array fails', () => {
  for (const b of [{}, { exclude: '../node_modules' }, { exclude: null }, null]) {
    assert.throws(() => overlay([mod('ecommerce', false)], b), /no `exclude` array/)
  }
})

test('a malformed registry fails', () => {
  assert.throws(() => typecheckOverlay({ base, registry: {}, root, isDirectory }), /no `modules` array/)
  assert.throws(() => overlay([{ id: 'ecommerce', enabled: 'false', nuxtLayer: './app/modules/ecommerce' }]), /boolean `enabled`/)
  assert.throws(() => overlay([{ enabled: false, nuxtLayer: './app/modules/ecommerce' }]), /string `id`/)
})
