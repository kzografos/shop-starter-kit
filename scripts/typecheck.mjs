#!/usr/bin/env node
// Frontend typecheck with the Module Registry applied (`pnpm typecheck`).
//
// Nuxt's generated .nuxt/tsconfig.json — the one the root tsconfig.json extends —
// includes `../app/**/*`, so a module switched off in modules.json stays in the
// TypeScript program after it has left the build: its `#shop` alias and its
// auto-imports are gone, its files are not, and they fail to typecheck. Nuxt
// offers no way to exclude files from that config (`typescript.tsConfig` and
// the `prepare:types` hook reach .nuxt/tsconfig.app.json only).
//
// So this script runs `nuxt prepare`, writes .nuxt/tsconfig.typecheck.json —
// the generated config plus one exclude per disabled module layer — and runs
// vue-tsc on that. With every module enabled the overlay adds nothing and the
// program is exactly the generated config's. The generated excludes are
// restated verbatim: an extending config's `exclude` replaces its base's.
//
// Only the disabled layers leave the program. A Core or project file that still
// imports one fails as before: `#shop/…` no longer resolves, and a relative
// import pulls the file back in, excluded or not.
//
// Editors keep reading the root tsconfig.json, so they still show a disabled
// module's errors; `pnpm typecheck` is the gate.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The layers nuxt.config.ts always extends, whatever modules.json says.
const ALWAYS_COMPOSED = ['app/core', 'app/project']

const isDirectoryOnDisk = (dir) => existsSync(dir) && statSync(dir).isDirectory()

/** `dir` is `parent` or lies below it (path.relative: case-insensitive on Windows). */
function within(dir, parent) {
  const rel = path.relative(parent, dir)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/**
 * The overlay config for the generated `base`: its excludes, verbatim, followed
 * by one glob (relative to `buildDir`) per module that modules.json disables.
 * Throws on anything that would make the exclusion wrong or wider than a
 * disabled module layer.
 */
export function typecheckOverlay({ base, registry, root, buildDir = path.join(root, '.nuxt'), isDirectory = isDirectoryOnDisk }) {
  if (!base || !Array.isArray(base.exclude)) {
    throw new Error('.nuxt/tsconfig.json has no `exclude` array — the generated excludes cannot be preserved')
  }
  if (!registry || !Array.isArray(registry.modules)) throw new Error('modules.json has no `modules` array')
  for (const m of registry.modules) {
    if (!m || typeof m.id !== 'string' || !m.id) throw new Error('modules.json: every module needs a string `id`')
    if (typeof m.enabled !== 'boolean') throw new Error(`modules.json: module "${m.id}" needs a boolean \`enabled\``)
  }

  const appDir = path.resolve(root, 'app')
  const protectedDirs = [
    ...ALWAYS_COMPOSED.map((dir) => path.resolve(root, dir)),
    ...registry.modules.filter((m) => m.enabled && typeof m.nuxtLayer === 'string').map((m) => path.resolve(root, m.nuxtLayer)),
  ]

  const globs = []
  for (const m of registry.modules.filter((m) => m.enabled === false)) {
    if (typeof m.nuxtLayer !== 'string' || !m.nuxtLayer.trim()) {
      throw new Error(`modules.json: disabled module "${m.id}" has no \`nuxtLayer\``)
    }
    // The path becomes a glob; it must not be one already.
    if (/[*?[\]{}!]/.test(m.nuxtLayer)) {
      throw new Error(`modules.json: module "${m.id}" nuxtLayer "${m.nuxtLayer}" contains glob characters`)
    }
    const layerDir = path.resolve(root, m.nuxtLayer)
    if (!within(layerDir, appDir) || within(appDir, layerDir)) {
      throw new Error(`modules.json: module "${m.id}" nuxtLayer "${m.nuxtLayer}" is not a directory inside app/`)
    }
    const clash = protectedDirs.find((dir) => within(layerDir, dir) || within(dir, layerDir))
    if (clash) {
      throw new Error(`modules.json: disabled module "${m.id}" nuxtLayer "${m.nuxtLayer}" overlaps ${path.relative(root, clash).split(path.sep).join('/')}, which stays composed`)
    }
    if (!isDirectory(layerDir)) {
      throw new Error(`modules.json: module "${m.id}" nuxtLayer "${m.nuxtLayer}" does not exist`)
    }
    const glob = path.relative(buildDir, layerDir).split(path.sep).join('/') + '/**/*'
    if (!globs.includes(glob)) globs.push(glob)
  }

  return { overlay: { extends: './tsconfig.json', exclude: [...base.exclude, ...globs] }, excluded: globs }
}

function readJson(file, what) {
  if (!existsSync(file)) throw new Error(`${what} not found at ${path.relative(ROOT, file)}`)
  try {
    return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch (err) {
    throw new Error(`${what} is not valid JSON: ${err.message}`)
  }
}

/** A package's CLI entry, run with this Node — no shell, no PATH lookup. */
function bin(pkg, name) {
  const manifest = createRequire(import.meta.url).resolve(`${pkg}/package.json`)
  const { bin: entries } = JSON.parse(readFileSync(manifest, 'utf8'))
  return path.join(path.dirname(manifest), typeof entries === 'string' ? entries : entries[name])
}

function run(label, args) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' })
  if (r.error) throw new Error(`${label} could not start: ${r.error.message}`)
  return r.status ?? 1
}

function main() {
  const prepared = run('nuxt prepare', [bin('nuxt', 'nuxt'), 'prepare'])
  if (prepared !== 0) {
    console.error(`typecheck: nuxt prepare failed (exit ${prepared})`)
    return prepared
  }

  const buildDir = path.join(ROOT, '.nuxt')
  const { overlay, excluded } = typecheckOverlay({
    base: readJson(path.join(buildDir, 'tsconfig.json'), 'the generated .nuxt/tsconfig.json'),
    registry: readJson(path.join(ROOT, 'modules.json'), 'modules.json'),
    root: ROOT,
    buildDir,
  })
  const target = path.join(buildDir, 'tsconfig.typecheck.json')
  try {
    writeFileSync(target, JSON.stringify(overlay, null, 2) + '\n')
  } catch (err) {
    throw new Error(`cannot write .nuxt/tsconfig.typecheck.json: ${err.message}`)
  }
  console.log(`typecheck: disabled module layers excluded: ${excluded.join(', ') || 'none'}`)

  return run('vue-tsc', [bin('vue-tsc', 'vue-tsc'), '--noEmit', '-p', target])
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main()
  } catch (err) {
    console.error(`typecheck: ${err.message}`)
    process.exitCode = 1
  }
}
