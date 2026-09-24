#!/usr/bin/env node
/**
 * Enabled-module ids for the backend composition root (E9a; roadmap C2).
 *
 * The registry that decides which application modules run is `modules.json` at
 * the repository root, and it stays the single source of truth. The backend
 * cannot import it: the Nest build would pull the repo root into `rootDir`
 * (moving `dist/main.js`), and the Docker build context is `./backend`, so the
 * file is not in the image. So the ids are generated into a committed TypeScript
 * constant instead — data crosses the boundary at generation time, not at build
 * or run time.
 *
 *   node scripts/generate-modules-enabled.js           write src/modules.enabled.ts
 *   node scripts/generate-modules-enabled.js --check   fail if the committed file is stale
 *
 * Output is deterministic: same registry in, same bytes out.
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const REGISTRY = path.resolve(__dirname, '..', '..', 'modules.json')
const TARGET = path.resolve(__dirname, '..', 'src', 'modules.enabled.ts')
const check = process.argv.includes('--check')

// `trim`: editors on Windows may leave a byte-order mark, which JSON.parse
// rejects and which `trim` counts as whitespace.
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8').trim())
if (!Array.isArray(registry.modules)) {
  console.error('generate-modules-enabled: modules.json has no `modules` array')
  process.exit(1)
}

// Registry order is preserved: it is the order the composition root imports in.
const ids = registry.modules.filter((m) => m.enabled).map((m) => m.id)
const list = ids.length ? ids.map((id) => `  '${id}',`).join('\n') + '\n' : ''

const contents = `// GENERATED FILE — DO NOT EDIT.
// Source: modules.json (repository root). Regenerate with:
//   npm run modules:generate       (backend/scripts/generate-modules-enabled.js)
// \`npm run verify:modules\` fails if this file drifts from the registry.
export const enabledModuleIds = [
${list}] as const

export type EnabledModuleId = (typeof enabledModuleIds)[number]
`

const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : null

if (check) {
  if (current === contents) {
    console.log(`verify:modules: OK — src/modules.enabled.ts matches modules.json (${ids.length} enabled: ${ids.join(', ') || 'none'})`)
    process.exit(0)
  }
  console.error('verify:modules: src/modules.enabled.ts is stale — run `npm run modules:generate` and commit the result')
  console.error(`  registry enables: ${ids.join(', ') || 'none'}`)
  process.exit(1)
}

if (current === contents) {
  console.log(`generate-modules-enabled: already up to date (${ids.length} enabled: ${ids.join(', ') || 'none'})`)
  process.exit(0)
}
fs.writeFileSync(TARGET, contents)
console.log(`generate-modules-enabled: wrote src/modules.enabled.ts (${ids.length} enabled: ${ids.join(', ') || 'none'})`)
