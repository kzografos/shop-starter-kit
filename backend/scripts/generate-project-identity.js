#!/usr/bin/env node
/**
 * Project identity for the backend composition root (Phase 3.1; blueprint
 * §8.1–§8.2).
 *
 * The project layer owns the brand: `BUSINESS` in app/project/project.config.ts
 * and the palette in app/project/assets/css/brand.css. The backend cannot import
 * either, for the reasons generate-modules-enabled.js gives (the Nest build
 * would pull the repo root into `rootDir`; the Docker build context is
 * `./backend`). So the values the mail layout reads are generated into a
 * committed constant, src/project.identity.ts, which the composition root hands
 * to ConfigModule (`load`). Loaded configuration wins over environment variables
 * of the same name, so BRAND_* in the environment no longer change anything.
 *
 *   BRAND_NAME      ← BUSINESS.name
 *   BRAND_COLOR     ← brand.css --brand-primary (a literal hex: email clients
 *                     cannot read CSS variables)
 *   BRAND_LOGO_URL  ← BUSINESS.brand.logo, null → '' (the text header)
 *
 * project.config.ts is TypeScript and is read through Node's type stripping, as
 * the frontend tests read the app's TypeScript; the npm scripts pass the flag:
 *
 *   npm run project:generate    write src/project.identity.ts
 *   npm run verify:project      fail if the committed file is stale
 *
 * Output is deterministic: same sources in, same bytes out. A missing or
 * malformed source value fails loudly; nothing is defaulted.
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const REPO = path.resolve(__dirname, '..', '..')
const PROJECT_CONFIG = path.join(REPO, 'app', 'project', 'project.config.ts')
const BRAND_CSS = path.join(REPO, 'app', 'project', 'assets', 'css', 'brand.css')
const TARGET = path.resolve(__dirname, '..', 'src', 'project.identity.ts')
const check = process.argv.includes('--check')
const label = check ? 'verify:project' : 'generate-project-identity'

function fail(message) {
  console.error(`${label}: ${message}`)
  process.exit(1)
}
// A BOM from a Windows editor, and CRLF from a checkout under core.autocrlf.
const readText = (file) => fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')
const rel = (file) => path.relative(REPO, file).split(path.sep).join('/')

async function main() {
  for (const file of [PROJECT_CONFIG, BRAND_CSS]) if (!fs.existsSync(file)) fail(`${rel(file)} not found`)

  const { BUSINESS } = await import(pathToFileURL(PROJECT_CONFIG).href)
  const where = rel(PROJECT_CONFIG)
  if (!BUSINESS || typeof BUSINESS !== 'object') fail(`${where} exports no BUSINESS object`)
  if (typeof BUSINESS.name !== 'string' || !BUSINESS.name.trim()) fail(`${where}: BUSINESS.name must be a non-empty string`)
  if (!BUSINESS.brand || !('logo' in BUSINESS.brand)) fail(`${where}: BUSINESS.brand.logo is missing`)
  const logo = BUSINESS.brand.logo
  if (logo !== null && typeof logo !== 'string') fail(`${where}: BUSINESS.brand.logo must be a string or null`)

  // `--brand-primary:` exactly — not `--brand-primary-dark`, not `var(--brand-primary)`.
  const primary = [...readText(BRAND_CSS).matchAll(/--brand-primary\s*:\s*([^;]+);/g)].map((m) => m[1].trim())
  if (primary.length !== 1) fail(`${rel(BRAND_CSS)}: expected one --brand-primary declaration, found ${primary.length}`)
  if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(primary[0])) {
    fail(`${rel(BRAND_CSS)}: --brand-primary must be a literal hex colour (emails cannot read CSS variables), got "${primary[0]}"`)
  }

  const identity = { BRAND_NAME: BUSINESS.name, BRAND_COLOR: primary[0], BRAND_LOGO_URL: logo ?? '' }
  const contents = `// GENERATED FILE — DO NOT EDIT.
// Source: app/project/project.config.ts (BUSINESS) and app/project/assets/css/brand.css
// (--brand-primary). Regenerate with:
//   npm run project:generate       (backend/scripts/generate-project-identity.js)
// \`npm run verify:project\` fails if this file drifts from its sources.
export const projectIdentity = {
  BRAND_NAME: ${JSON.stringify(identity.BRAND_NAME)},
  BRAND_COLOR: ${JSON.stringify(identity.BRAND_COLOR)},
  BRAND_LOGO_URL: ${JSON.stringify(identity.BRAND_LOGO_URL)},
} as const
`
  const summary = Object.entries(identity).map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(', ')
  const current = fs.existsSync(TARGET) ? readText(TARGET) : null

  if (check) {
    if (current === contents) {
      console.log(`verify:project: OK — src/project.identity.ts matches the project config (${summary})`)
      return
    }
    fail('src/project.identity.ts is stale — run `npm run project:generate` and commit the result')
  }
  if (current === contents) {
    console.log(`generate-project-identity: already up to date (${summary})`)
    return
  }
  fs.writeFileSync(TARGET, contents)
  console.log(`generate-project-identity: wrote src/project.identity.ts (${summary})`)
}

main().catch((err) => fail(err && err.message ? err.message : String(err)))
