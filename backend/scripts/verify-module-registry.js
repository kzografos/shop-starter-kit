#!/usr/bin/env node
/**
 * Module Registry ↔ source tree check (E9b4).
 *
 * The layer map treats every directory under `src/modules/` as a module, so a
 * directory nobody declared is silently granted module status: the boundary
 * rules protect it, the audit counts it as SHOP, and yet no descriptor composes
 * it — it is code that ships in the build and runs nowhere.
 *
 * This check compares the directories that exist with the ones `modules.json`
 * declares. Registration is the question, not enablement: a registered module
 * that is switched off is still declared, and its files are expected to be
 * there (E9b1 semantics).
 *
 *   node scripts/verify-module-registry.js
 *   node scripts/verify-module-registry.js --backend <dir>   # alternate source root
 *
 * It lives beside the other verify-* scripts rather than inside the boundary or
 * audit tooling, so their outputs stay byte-identical and this concern reports
 * on its own.
 */
'use strict'
const path = require('node:path')
const registry = require('./lib/modules-registry')

const argv = process.argv.slice(2)
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const backendSrc = path.resolve(opt('--backend') ?? path.join(__dirname, '..', 'src'))

const registered = registry.backendDirs()
const unregistered = registry.unregisteredBackendDirs({ backendSrc })

if (unregistered.length) {
  console.error('verify-module-registry: module directories with no entry in modules.json:')
  for (const dir of unregistered) console.error(`  src/${dir}`)
  console.error('  add a descriptor for each, or remove the directory')
  process.exit(1)
}

const declared = registry.readRegistry()
const enabled = declared.filter((m) => m.enabled).map((m) => m.id)
const disabled = declared.filter((m) => !m.enabled).map((m) => m.id)
const summary = [`${registered.length} registered`, `${enabled.length} enabled`]
if (disabled.length) summary.push(`disabled: ${disabled.join(', ')}`)
console.log(`verify-module-registry: OK — every module directory is registered (${summary.join(', ')})`)
