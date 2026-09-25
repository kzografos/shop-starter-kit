#!/usr/bin/env node
/**
 * Prisma schema composition for the Module Registry (E9e2; roadmap C2).
 *
 * `backend/prisma/` is the effective schema folder: Prisma loads every `*.prisma`
 * in it (recursively), the Dockerfile generates from it and start.sh migrates
 * with it. Core owns `core.prisma` and `infrastructure.prisma`; each registered
 * module owns the file its `prismaSchema` names.
 *
 * What a module cannot own through its own file is a field on a Core model:
 * Prisma requires both sides of every relation and has no way to extend a
 * model from another file. So a module ships those fields as a fragment,
 *
 *   src/<backendDir>/prisma/<Model>.relations.fragment
 *
 * and this script writes them into a marker-delimited region of the Core model:
 *
 *   // <module-relations model="User"> generated from the registered modules' fragments — do not edit
 *   // ecommerce
 *   orders              Order[]
 *   // </module-relations>
 *
 * Only the text between the markers is ever rewritten. With no module
 * contributing, the region is empty and Core is a valid schema on its own.
 *
 * REGISTERED modules take part, not only enabled ones: a disabled module's
 * source is still compiled, so its models must stay in the client.
 *
 * The result is committed, like `src/modules.enabled.ts`: the Docker build
 * context is `./backend` and cannot see `modules.json`.
 *
 *   node scripts/generate-prisma-schema.js           rewrite the regions
 *   node scripts/generate-prisma-schema.js --check   fail if a region is stale
 *
 * Field alignment follows `prisma format` (blank lines split alignment groups,
 * comments do not; name and type columns are the longest in the group + 1, the
 * type column only where attributes follow), so formatting the schema never
 * makes `--check` fail.
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const registry = require('./lib/modules-registry')

const BACKEND = path.resolve(__dirname, '..')
// The registry's own roots, so `prismaSchema` and `backendDir` resolve exactly
// as they do for moduleModels(), backendDirs() and the other registry tooling.
const REGISTRY = registry.DEFAULTS.registry
const PRISMA = registry.DEFAULTS.prisma
const SRC = registry.DEFAULTS.backendSrc
// Core's own schema files: always part of the schema, and the only files that
// may carry regions.
const BASE = ['core.prisma', 'infrastructure.prisma']
const check = process.argv.includes('--check')

const posix = (p) => p.split(path.sep).join('/')
const fail = (message, detail = []) => {
  console.error(`${check ? 'verify:schema' : 'generate-prisma-schema'}: ${message}`)
  for (const line of detail) console.error('  ' + line)
  process.exit(1)
}
// A BOM from a Windows editor, and CRLF from a checkout under core.autocrlf.
const readText = (file) => fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')

const BEGIN = (model) => `  // <module-relations model="${model}"> generated from the registered modules' fragments — do not edit`
const END = '  // </module-relations>'
const BEGIN_RE = /^ {2}\/\/ <module-relations model="(\w+)">/
const END_RE = /^ {2}\/\/ <\/module-relations>\s*$/
const FIELD_RE = /^\s*([A-Za-z_]\w*)\s+(\S+)(?:\s+(.*?))?\s*$/

const modules = registry.readRegistry(REGISTRY)

// ── 1. every registered module's schema exists; nothing else is loaded ──
const claimed = new Set(BASE)
for (const m of modules) {
  if (!m.prismaSchema) continue
  const rel = posix(path.normalize(m.prismaSchema))
  if (!fs.existsSync(path.join(PRISMA, rel))) {
    fail(`module "${m.id}" registers prismaSchema "${m.prismaSchema}", but prisma/${rel} does not exist`)
  }
  claimed.add(rel)
}
// Prisma loads the folder recursively, so an unclaimed schema anywhere under
// it — a removed module's file left behind — would be loaded all the same.
// migrations/ holds SQL only and is skipped.
const orphans = []
;(function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const rel = posix(path.relative(PRISMA, full))
    if (entry.isDirectory()) { if (rel !== 'migrations') scan(full); continue }
    if (entry.name.endsWith('.prisma') && !claimed.has(rel)) orphans.push(`prisma/${rel}`)
  }
})(PRISMA)
if (orphans.length) {
  fail('schema files that no registered module claims (Prisma would still load them):', [
    ...orphans,
    'register the module in modules.json, or remove the file with the module',
  ])
}

// ── 2. fragments, per target model, in registry order ────────────
const contributions = new Map() // model → [{ id, file, fields: [{ name, type, attrs }] }]
for (const m of modules) {
  if (!m.backendDir) continue
  const dir = path.join(SRC, m.backendDir, 'prisma')
  if (!fs.existsSync(dir)) continue
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.relations.fragment')).sort()
  for (const file of files) {
    const model = file.slice(0, -'.relations.fragment'.length)
    const where = posix(path.relative(BACKEND, path.join(dir, file)))
    if (!/^[A-Z]\w*$/.test(model)) fail(`${where}: "${model}" is not a model name`)
    const fields = []
    for (const raw of readText(path.join(dir, file)).split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('//')) continue
      // A fragment adds fields to someone else's model and nothing more: no
      // blocks, no block attributes (@@index, @@map …), no braces.
      if (/^(model|enum|type|view|datasource|generator)\b/.test(line) || /[{}]/.test(line) || line.startsWith('@@')) {
        fail(`${where}: fragments may contain field lines only, got "${line}"`)
      }
      const match = FIELD_RE.exec(line)
      if (!match) fail(`${where}: not a field line: "${line}"`)
      fields.push({ name: match[1], type: match[2], attrs: match[3] || '' })
    }
    if (!fields.length) continue
    if (!contributions.has(model)) contributions.set(model, [])
    contributions.get(model).push({ id: m.id, file: where, fields })
  }
}

// ── 3. rewrite the regions of the base files ─────────────────────
const regionsFound = new Set()
const results = []
for (const base of BASE) {
  const file = path.join(PRISMA, base)
  const raw = fs.readFileSync(file, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const bom = raw.startsWith('﻿') ? '﻿' : ''
  const lines = readText(file).split('\n')
  const out = []
  let model = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const opens = /^model\s+(\w+)\s*\{/.exec(line)
    if (opens) model = opens[1]
    if (/^\}/.test(line)) model = null

    const begin = BEGIN_RE.exec(line)
    if (!begin) { out.push(line); continue }

    const target = begin[1]
    if (target !== model) fail(`prisma/${base}:${i + 1}: region for "${target}" is not inside model ${target}`)
    if (regionsFound.has(target)) fail(`prisma/${base}:${i + 1}: a second region for "${target}"`)
    regionsFound.add(target)
    let end = i + 1
    while (end < lines.length && !END_RE.test(lines[end])) {
      if (BEGIN_RE.test(lines[end]) || /^\}/.test(lines[end])) break
      end++
    }
    if (end >= lines.length || !END_RE.test(lines[end])) fail(`prisma/${base}:${i + 1}: region for "${target}" has no closing // </module-relations>`)

    const contributed = contributions.get(target) ?? []
    // The model's own fields, outside the region, are Core's.
    const own = modelFields(lines, target).filter((f) => f.index < i || f.index > end)
    const byName = new Map(own.map((f) => [f.name, 'core']))
    const clashes = []
    for (const c of contributed) {
      for (const f of c.fields) {
        if (byName.has(f.name)) clashes.push(`${target}.${f.name}: ${c.id} (${c.file}) and ${byName.get(f.name)}`)
        else byName.set(f.name, c.id)
      }
    }
    if (clashes.length) fail(`duplicate fields contributed to model ${target}:`, clashes)

    // Alignment group: contiguous non-blank lines around the region.
    const group = [...contributed.flatMap((c) => c.fields)]
    for (let k = i - 1; k >= 0 && lines[k].trim() && !/^model\s/.test(lines[k]); k--) pushField(group, lines[k])
    for (let k = end + 1; k < lines.length && lines[k].trim() && !/^\s*(@@|\})/.test(lines[k]); k++) pushField(group, lines[k])
    const nameW = Math.max(...group.map((f) => f.name.length)) + 1
    const typeW = Math.max(...group.map((f) => f.type.length)) + 1

    out.push(BEGIN(target))
    for (const c of contributed) {
      out.push(`  // ${c.id}`)
      for (const f of c.fields) out.push(`  ${f.name.padEnd(nameW)}${f.attrs ? f.type.padEnd(typeW) + f.attrs : f.type}`)
    }
    out.push(END)
    i = end
  }

  const current = lines.join('\n')
  const composed = out.join('\n')
  results.push({ base, file, changed: current !== composed, write: () => fs.writeFileSync(file, bom + composed.split('\n').join(eol)) })
}

const unplaced = [...contributions.keys()].filter((m) => !regionsFound.has(m))
if (unplaced.length) {
  fail('fragments target models that have no <module-relations> region:', unplaced.map((m) =>
    `${m} ← ${contributions.get(m).map((c) => c.file).join(', ')}`))
}

const summary = [...regionsFound].map((m) => `${m}: ${(contributions.get(m) ?? []).map((c) => c.id).join(', ') || 'none'}`).join('; ')
const stale = results.filter((r) => r.changed)

if (check) {
  if (!stale.length) {
    console.log(`verify:schema: OK — prisma/ matches the registered modules (${modules.length} registered; ${summary || 'no regions'})`)
    process.exit(0)
  }
  fail('the composed Prisma schema is stale — run `npm run prisma:compose` and commit the result', stale.map((r) => `prisma/${r.base}`))
}

if (!stale.length) {
  console.log(`generate-prisma-schema: already up to date (${summary || 'no regions'})`)
  process.exit(0)
}
for (const r of stale) r.write()
console.log(`generate-prisma-schema: wrote ${stale.map((r) => `prisma/${r.base}`).join(', ')} (${summary})`)

// ── helpers ──────────────────────────────────────────────────────
/** Field lines of `model <name> { … }`, with their line index. */
function modelFields(lines, name) {
  const fields = []
  let inside = false
  lines.forEach((line, index) => {
    if (new RegExp(`^model\\s+${name}\\s*\\{`).test(line)) { inside = true; return }
    if (inside && /^\}/.test(line)) { inside = false; return }
    if (!inside) return
    const t = line.trim()
    if (!t || t.startsWith('//') || t.startsWith('@@')) return
    const m = FIELD_RE.exec(t)
    if (m) fields.push({ name: m[1], type: m[2], index })
  })
  return fields
}

function pushField(group, line) {
  const t = line.trim()
  if (!t || t.startsWith('//') || t.startsWith('@@')) return
  const m = FIELD_RE.exec(t)
  if (m) group.push({ name: m[1], type: m[2] })
}
