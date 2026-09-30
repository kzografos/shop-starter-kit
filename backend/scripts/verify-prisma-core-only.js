#!/usr/bin/env node
/**
 * Core-only Prisma check (E9e4; roadmap C2).
 *
 * Proves that with NO module registered, Core and Infrastructure stand on their
 * own at the Prisma level:
 *
 *   empty registry → the real composer → core + infrastructure schema
 *   → prisma validate → prisma generate (isolated) → typecheck of Core,
 *   Infrastructure and the composition root against that client
 *
 * This is the "module removed" state, not "module disabled". A registered but
 * disabled module keeps its models in the schema and the client, because its
 * source is still compiled (E9e Tier 1); only unregistering a module takes its
 * models away, and that is what this check simulates.
 *
 * Nothing in the repository is modified, and nothing contacts a database:
 *  - the composer and the registry helper are copied byte-for-byte into a
 *    scratch tree under node_modules/ (gitignored, and inside the backend so
 *    Prisma resolves the backend's own install). The helper's DEFAULTS derive
 *    from its own location, so the unmodified composer composes the scratch
 *    tree — no second implementation and no test flag on the real one;
 *  - the Core-only client is generated into that scratch tree, never into
 *    node_modules/.prisma/client (whose index.d.ts is hashed before and after);
 *  - the scratch tree is removed in `finally` and on exit.
 *
 * The typecheck selects Core, Infrastructure and the root files, and asks
 * TypeScript for the diagnostics of exactly those files. `tsc` cannot do this:
 * the composition root imports each module's Nest class (E9a), so compiling
 * the root with `tsc` would typecheck the module's source too. Here module
 * declarations may still be referenced, but module files are never checked.
 *
 * Two guards keep the result honest: the same program is first checked against
 * the real (full) client, which must report 0 errors, and a synthetic probe
 * that reads a module-owned model through PrismaService must compile against
 * the full client and FAIL against the Core-only one.
 *
 *   node scripts/verify-prisma-core-only.js
 *
 * Requires `prisma generate` to have produced the real client (the control
 * typecheck uses it); needs no build.
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const registry = require('./lib/modules-registry')

const BACKEND = path.resolve(__dirname, '..')
const SRC = registry.DEFAULTS.backendSrc
const PRISMA = registry.DEFAULTS.prisma
const PRISMA_CLI = require.resolve('prisma/build/index.js', { paths: [BACKEND] })
const REAL_CLIENT = path.join(path.dirname(require.resolve('.prisma/client/index.d.ts', { paths: [BACKEND] })))
const SCRATCH = path.join(BACKEND, 'node_modules', `.verify-prisma-core-only-${process.pid}`)
const TAG = 'verify-prisma-core-only'

const posix = (p) => p.split(path.sep).join('/')
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const cleanup = () => { try { fs.rmSync(SCRATCH, { recursive: true, force: true }) } catch { /* exiting anyway */ } }
process.on('exit', cleanup)

class Failure extends Error {
  constructor(message, detail = []) { super(message); this.detail = detail }
}
const assert = (ok, message, detail) => { if (!ok) throw new Failure(message, detail) }

function prisma(args) {
  // A placeholder URL: validate and generate read `env("DATABASE_URL")` but
  // never connect. Pinned so a local .env cannot supply a real one.
  const run = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: BACKEND,
    env: { ...process.env, DATABASE_URL: 'postgresql://verify:verify@127.0.0.1:5432/verify' },
    encoding: 'utf8',
  })
  const out = `${run.stdout || ''}${run.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '')
  return { ok: run.status === 0, out }
}

/** `model X {` names declared in the given schema files. */
const modelsIn = (files) => files.flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]))

function main() {
  const realClientTypes = path.join(REAL_CLIENT, 'index.d.ts')
  assert(fs.existsSync(realClientTypes), 'the real Prisma client is missing — run `npm run db:generate` first')
  const realClientHash = sha(realClientTypes)

  // ── 1. scratch tree: the real composer, an empty registry, Core's schemas ──
  const modules = registry.readRegistry()
  const moduleSchemas = new Set(modules.filter((m) => m.prismaSchema).map((m) => posix(path.normalize(m.prismaSchema))))
  // Core's schema files are the ones no registered module claims. Anything a
  // module claims is exactly what unregistering it removes.
  const coreSchemas = fs.readdirSync(PRISMA).filter((f) => f.endsWith('.prisma') && !moduleSchemas.has(f)).sort()
  assert(coreSchemas.length > 0, 'no Core schema files found under prisma/')

  const tree = path.join(SCRATCH, 'backend')
  fs.mkdirSync(path.join(tree, 'scripts', 'lib'), { recursive: true })
  fs.mkdirSync(path.join(tree, 'prisma'), { recursive: true })
  fs.mkdirSync(path.join(tree, 'src'), { recursive: true })
  fs.writeFileSync(path.join(SCRATCH, 'modules.json'), '{ "modules": [] }\n')
  for (const f of ['generate-prisma-schema.js', 'lib/modules-registry.js']) {
    fs.copyFileSync(path.join(__dirname, f), path.join(tree, 'scripts', f))
    assert(sha(path.join(__dirname, f)) === sha(path.join(tree, 'scripts', f)), `scripts/${f} was not copied byte-for-byte`)
  }
  for (const f of coreSchemas) fs.copyFileSync(path.join(PRISMA, f), path.join(tree, 'prisma', f))

  // ── 2. compose with nothing registered ──────────────────────────
  const composer = path.join(tree, 'scripts', 'generate-prisma-schema.js')
  const composed = spawnSync(process.execPath, [composer], { encoding: 'utf8' })
  assert(composed.status === 0, 'the composer rejected the Core-only registry', (composed.stderr || composed.stdout).trim().split('\n'))
  const checked = spawnSync(process.execPath, [composer, '--check'], { encoding: 'utf8' })
  assert(checked.status === 0, 'the Core-only composition is not stable under --check', (checked.stderr || checked.stdout).trim().split('\n'))

  const scratchSchemas = coreSchemas.map((f) => path.join(tree, 'prisma', f))
  const regionFields = []
  for (const file of scratchSchemas) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    for (const region of text.matchAll(/<module-relations model="(\w+)">[^\n]*\n([\s\S]*?)\s*\/\/ <\/module-relations>/g)) {
      for (const line of region[2].split('\n')) if (line.trim() && !line.trim().startsWith('//')) regionFields.push(`${region[1]}: ${line.trim()}`)
    }
    // Outside the regions the composed file must be the real one, untouched.
    const strip = (t) => t.replace(/\r\n/g, '\n').replace(/ {2}\/\/ <module-relations[\s\S]*?\/\/ <\/module-relations>\n/g, '')
    assert(strip(text) === strip(fs.readFileSync(path.join(PRISMA, path.basename(file)), 'utf8')),
      `prisma/${path.basename(file)}: the Core-only composition changed content outside its regions`)
  }
  assert(!regionFields.length, 'module fields remain in a region with nothing registered:', regionFields)

  const validated = prisma(['validate', '--schema', posix(path.join(tree, 'prisma'))])
  assert(validated.ok, 'the Core-only schema is not valid', validated.out.split('\n').filter((l) => /error|Error/.test(l)).slice(0, 8))

  // ── 3. generate an isolated Core-only client ─────────────────────
  const clientOut = path.join(SCRATCH, 'client')
  const core = path.join(tree, 'prisma', 'core.prisma')
  const withOutput = fs.readFileSync(core, 'utf8').replace(
    /(generator\s+client\s*\{[^}]*?provider\s*=\s*"prisma-client-js")/,
    `$1\n  output   = "${posix(clientOut)}"`,
  )
  assert(withOutput.includes(posix(clientOut)), 'could not point the scratch generator at an isolated output')
  fs.writeFileSync(core, withOutput)
  const generated = prisma(['generate', '--schema', posix(path.join(tree, 'prisma'))])
  assert(generated.ok, 'prisma generate failed for the Core-only schema', generated.out.split('\n').filter(Boolean).slice(-6))
  assert(sha(realClientTypes) === realClientHash, 'the real Prisma client changed while generating the Core-only one')

  // Model surface: exactly Core's models, none of any module's. Read from the
  // generated source rather than require()d: loading the client can load its
  // native engine, which Windows then locks against the cleanup below.
  const modelBlock = /exports\.Prisma\.ModelName\s*=\s*\{([^}]*)\}/.exec(fs.readFileSync(path.join(clientOut, 'index.js'), 'utf8'))
  assert(modelBlock, 'could not find Prisma.ModelName in the generated Core-only client')
  const surface = [...modelBlock[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]).sort()
  const expected = modelsIn(scratchSchemas).sort()
  const moduleModels = modelsIn([...moduleSchemas].map((f) => path.join(PRISMA, f)).filter((f) => fs.existsSync(f))).sort()
  assert(surface.length > 0, 'the Core-only client has no models')
  assert(JSON.stringify(surface) === JSON.stringify(expected), 'the Core-only client does not expose exactly the Core schema models',
    [`client: ${surface.join(', ')}`, `schema: ${expected.join(', ')}`])
  const leaked = surface.filter((m) => moduleModels.includes(m))
  assert(!leaked.length, 'module models leaked into the Core-only client:', leaked)

  // ── 4. typecheck Core, Infrastructure and the root ──────────────
  const ts = require(require.resolve('typescript', { paths: [BACKEND] }))
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [])
  const moduleRoots = registry.backendDirs().map((d) => path.join(SRC, d.split('/')[0]))
  const selected = [
    ...fs.readdirSync(SRC).filter((f) => f.endsWith('.ts')).map((f) => path.join(SRC, f)),
    ...fs.readdirSync(SRC, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !moduleRoots.includes(path.join(SRC, e.name)))
      .flatMap((e) => walk(path.join(SRC, e.name))),
  ].sort()
  assert(selected.length > 0, 'no Core/Infrastructure/root source selected')
  assert(!selected.some((f) => moduleRoots.some((r) => f.startsWith(r + path.sep))), 'module source leaked into the Core selection')

  // A synthetic Core file reading a module-owned model through PrismaService.
  // With no module models at all there is nothing to leak, and the probe is
  // skipped; the control run still proves the harness.
  const probeModel = moduleModels[0]
  const probe = path.join(SCRATCH, 'probe.ts')
  const service = posix(path.relative(SCRATCH, path.join(SRC, 'infrastructure', 'prisma', 'prisma.service'))).replace(/^(?!\.)/, './')
  const delegate = probeModel ? probeModel[0].toLowerCase() + probeModel.slice(1) : null
  fs.writeFileSync(probe, delegate
    ? `import { PrismaService } from '${service}'\nexport const probe = (prisma: PrismaService) => prisma.${delegate}.findMany()\n`
    : 'export {}\n')

  const typecheck = (clientDir) => {
    const parsed = ts.getParsedCommandLineOfConfigFile(path.join(BACKEND, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} })
    const options = {
      ...parsed.options,
      noEmit: true,
      incremental: false,
      paths: { ...(parsed.options.paths || {}), '@prisma/client': [posix(clientDir)] },
    }
    // A `paths` target that fails to resolve silently falls back to ordinary
    // node_modules resolution — the full client — which would make the
    // Core-only run pass vacuously. So the mapping itself is asserted.
    const from = path.join(SRC, 'infrastructure', 'prisma', 'prisma.service.ts')
    const resolved = ts.resolveModuleName('@prisma/client', from, options, ts.sys).resolvedModule
    const rel = resolved ? path.relative(clientDir, resolved.resolvedFileName) : '..'
    assert(!rel.startsWith('..') && !path.isAbsolute(rel), `@prisma/client does not resolve to ${posix(path.relative(BACKEND, clientDir))}`,
      [`resolved: ${resolved ? posix(path.relative(BACKEND, resolved.resolvedFileName)) : 'nothing'}`])
    const program = ts.createProgram({ rootNames: [...selected, probe], options })
    const count = (file) => {
      const sf = program.getSourceFile(file)
      assert(sf, `TypeScript did not load ${posix(path.relative(BACKEND, file))}`)
      return [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)]
    }
    const errors = selected.flatMap(count).concat(program.getOptionsDiagnostics(), program.getGlobalDiagnostics())
    const format = (d) => `${d.file ? posix(path.relative(BACKEND, d.file.fileName)) : ''} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
    return { errors: errors.map(format), probe: count(probe).map(format) }
  }

  const control = typecheck(REAL_CLIENT)
  assert(!control.errors.length, 'control: Core/Infrastructure/root do not typecheck even against the full client — the harness is broken', control.errors.slice(0, 8))
  assert(!control.probe.length, 'control: the probe does not compile against the full client', control.probe)

  const coreOnly = typecheck(clientOut)
  assert(!coreOnly.errors.length, 'Core/Infrastructure/root depend on module-owned Prisma models:', coreOnly.errors.slice(0, 12))
  if (delegate) assert(coreOnly.probe.length > 0, `the probe reading prisma.${delegate} compiled against the Core-only client — the check cannot see module models`)

  console.log(`${TAG}: OK — Core stands alone at the Prisma level with no module registered`)
  console.log(`  schema: ${coreSchemas.join(', ')} (valid; ${[...moduleSchemas].join(', ') || 'none'} left out)`)
  console.log(`  client: ${surface.join(', ')}`)
  console.log(`  typecheck: ${selected.length} Core/Infrastructure/root files, 0 errors (control against the full client: 0)`)
  console.log(delegate
    ? `  probe: prisma.${delegate} → ${coreOnly.probe.length} error(s) against the Core-only client, as required`
    : '  probe: skipped (no module models registered)')
}

try {
  main()
} catch (err) {
  if (err instanceof Failure) {
    console.error(`${TAG}: ${err.message}`)
    for (const line of err.detail || []) console.error('  ' + line)
  } else {
    console.error(`${TAG}: failed:`, err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n') : err)
  }
  process.exitCode = 1
} finally {
  cleanup()
  if (fs.existsSync(SCRATCH)) {
    console.error(`${TAG}: could not remove ${posix(path.relative(BACKEND, SCRATCH))} — delete it by hand`)
    process.exitCode = 1
  }
}
