// Enabled-module ids (E9a). `verify:modules` compares the committed
// src/modules.enabled.ts with what modules.json generates. A Windows checkout
// under core.autocrlf, or an editor's BOM, must not make that file look stale;
// a genuine content difference must still fail, whatever its line endings.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GENERATOR = path.join(BACKEND, 'scripts', 'generate-modules-enabled.js')

const registry = (enabled) => JSON.stringify({ modules: [{ id: 'ecommerce', enabled, backendDir: 'modules/ecommerce' }] }, null, 2) + '\n'
const crlf = (s) => s.replace(/\r?\n/g, '\r\n')

// A throw-away repository: the generator resolves modules.json and its target
// from its own location, so a copy under <root>/backend/scripts reads
// <root>/modules.json and writes <root>/backend/src/modules.enabled.ts.
function fixture({ modules = registry(true), target, script = (s) => s } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'modules-enabled-'))
  const w = (rel, content) => { mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); writeFileSync(path.join(root, rel), content) }
  w('modules.json', modules)
  w('backend/package.json', '{}\n') // as backend/: the generator is CommonJS
  w('backend/scripts/generate-modules-enabled.js', script(readFileSync(GENERATOR, 'utf8')))
  mkdirSync(path.join(root, 'backend', 'src'), { recursive: true })
  if (target !== undefined) w('backend/src/modules.enabled.ts', target)
  const run = (...args) => spawnSync(process.execPath, [path.join(root, 'backend', 'scripts', 'generate-modules-enabled.js'), ...args], { encoding: 'utf8' })
  return { root, run, target: path.join(root, 'backend', 'src', 'modules.enabled.ts') }
}
const withFixture = (spec, fn) => { const f = fixture(spec); try { fn(f) } finally { rmSync(f.root, { recursive: true, force: true }) } }

// What the generator writes for a registry, taken from the generator itself.
function generated(modules) {
  let out
  withFixture({ modules }, (f) => {
    assert.equal(f.run().status, 0)
    out = readFileSync(f.target, 'utf8')
  })
  assert.ok(out.includes('\n') && !out.includes('\r'), 'the generator writes LF')
  return out
}
const LF = generated(registry(true))

test('the same content passes --check as LF, CRLF, or with a leading BOM', () => {
  const cases = {
    LF,
    CRLF: crlf(LF),
    'BOM + LF': '\uFEFF' + LF,
    'BOM + CRLF': '\uFEFF' + crlf(LF),
  }
  for (const [name, target] of Object.entries(cases)) {
    withFixture({ target }, (f) => {
      const r = f.run('--check')
      assert.equal(r.status, 0, `${name}: ${r.stderr}`)
      assert.match(r.stdout, /verify:modules: OK/)
    })
  }
  // A Windows checkout converts the generator itself too; its output is still LF.
  withFixture({ target: crlf(LF), modules: crlf(registry(true)), script: crlf }, (f) => {
    assert.equal(f.run('--check').status, 0, 'CRLF generator, registry and target')
  })
})

test('write mode leaves an equivalent CRLF file byte-for-byte untouched (a Windows checkout)', () => {
  withFixture({ target: crlf(LF) }, (f) => {
    const before = readFileSync(f.target)
    const r = f.run()
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /already up to date/)
    assert.deepEqual(readFileSync(f.target), before)
  })
})

test('a genuine content difference still fails --check, whatever its line endings', () => {
  // The committed file enables nothing while the registry enables ecommerce.
  const stale = generated(registry(false))
  const cases = {
    'LF, different ids': stale,
    'CRLF, different ids': crlf(stale),
    'BOM + CRLF, different ids': '\uFEFF' + crlf(stale),
    'LF, one extra blank line': LF + '\n', // no whitespace trimming
    'LF, trailing space on a line': LF.replace('] as const', '] as const '),
  }
  for (const [name, target] of Object.entries(cases)) {
    withFixture({ target }, (f) => {
      const r = f.run('--check')
      assert.equal(r.status, 1, name)
      assert.match(r.stderr, /src\/modules\.enabled\.ts is stale/, name)
      assert.equal(readFileSync(f.target, 'utf8'), target, `${name}: --check never writes`)
    })
  }
  // Write mode replaces a genuinely stale file with the generated LF content.
  withFixture({ target: crlf(stale) }, (f) => {
    assert.match(f.run().stdout, /wrote src\/modules\.enabled\.ts/)
    assert.equal(readFileSync(f.target, 'utf8'), LF)
  })
})
