// Project identity (Phase 3.1). The committed src/project.identity.ts matches
// its sources, a stale copy or a missing source value fails loudly, and the
// values the composition root loads win over BRAND_* in the environment — the
// @nestjs/config 4.x precedence this design relies on.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GENERATOR = path.join(BACKEND, 'scripts', 'generate-project-identity.js')
const run = (script, ...args) =>
  spawnSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', script, ...args], { encoding: 'utf8' })

// A throw-away repository: the generator resolves its sources and its target
// from its own location, so a copy under <root>/backend/scripts reads
// <root>/app/project and writes <root>/backend/src.
function fixture({ config, css, target }) {
  const root = mkdtempSync(path.join(tmpdir(), 'project-identity-'))
  const w = (rel, content) => { mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); writeFileSync(path.join(root, rel), content) }
  w('package.json', '{ "type": "module" }\n') // as the repository root: project.config.ts is ESM
  w('backend/package.json', '{}\n') // as backend/: the generator is CommonJS
  w('app/project/project.config.ts', config)
  w('app/project/assets/css/brand.css', css)
  mkdirSync(path.join(root, 'backend', 'src'), { recursive: true })
  if (target !== undefined) w('backend/src/project.identity.ts', target)
  const script = path.join(root, 'backend', 'scripts', 'generate-project-identity.js')
  mkdirSync(path.dirname(script), { recursive: true })
  copyFileSync(GENERATOR, script)
  return { root, script, target: path.join(root, 'backend', 'src', 'project.identity.ts') }
}
const withFixture = (spec, fn) => { const f = fixture(spec); try { fn(f) } finally { rmSync(f.root, { recursive: true, force: true }) } }

const CONFIG = "export const BUSINESS = { name: 'Fixture Shop', brand: { logo: null as string | null } }\n"
const CSS = ':root {\n  --brand-primary: #123456; /* accent */\n  --brand-primary-dark: #000000;\n}\n'

test('the committed project identity matches project.config.ts and brand.css', () => {
  const r = run(GENERATOR, '--check')
  assert.equal(r.status, 0, r.stderr)
})

test('a stale generated file fails --check and is left untouched; regenerating is deterministic', () => {
  withFixture({ config: CONFIG, css: CSS, target: '// stale\n' }, (f) => {
    const stale = run(f.script, '--check')
    assert.equal(stale.status, 1)
    assert.match(stale.stderr, /verify:project: src\/project\.identity\.ts is stale/)
    assert.equal(readFileSync(f.target, 'utf8'), '// stale\n')

    assert.equal(run(f.script).status, 0)
    const generated = readFileSync(f.target, 'utf8')
    assert.match(generated, /BRAND_NAME: "Fixture Shop",\n {2}BRAND_COLOR: "#123456",\n {2}BRAND_LOGO_URL: "",/)
    assert.equal(run(f.script, '--check').status, 0)
    assert.equal(run(f.script).status, 0)
    assert.equal(readFileSync(f.target, 'utf8'), generated, 'same sources, same bytes')
  })
})

test('a missing BUSINESS.name fails loudly and writes nothing', () => {
  withFixture({ config: 'export const BUSINESS = { brand: { logo: null } }\n', css: CSS }, (f) => {
    const r = run(f.script)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /BUSINESS\.name must be a non-empty string/)
    assert.equal(existsSync(f.target), false)
  })
})

test('a missing --brand-primary fails loudly and writes nothing', () => {
  withFixture({ config: CONFIG, css: ':root {\n  --brand-primary-dark: #000000;\n}\n' }, (f) => {
    const r = run(f.script)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /expected one --brand-primary declaration, found 0/)
    assert.equal(existsSync(f.target), false)
  })
})

test('the loaded project identity wins over BRAND_* in the environment', async () => {
  // The stub environment of verify-providers: Core keys satisfy the schema, no
  // provider is configured, Redis is lazy — the app composes and connects to nothing.
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://verify:verify@127.0.0.1:5432/verify',
    REDIS_URL: 'redis://127.0.0.1:6379/?lazyConnect=true',
    JWT_SECRET: 'verify-only-secret-not-for-use-0123456789ab',
    JWT_REFRESH_SECRET: 'verify-only-refresh-not-for-use-0123456789',
    MINIO_ENDPOINT: '', STRIPE_SECRET_KEY: '', GOOGLE_CLIENT_ID: '', MAIL_TRANSPORT: 'resend', RESEND_API_KEY: '',
    BRAND_NAME: 'From The Environment', BRAND_COLOR: '#000000', BRAND_LOGO_URL: 'https://env.invalid/logo.png',
  })
  const { NestFactory } = require('@nestjs/core')
  const { ConfigService } = require('@nestjs/config')
  const { AppModule } = require('../dist/app.module.js')
  const { MailService } = require('../dist/infrastructure/mail/mail.service.js')
  const { projectIdentity } = require('../dist/project.identity.js')

  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false })
  try {
    const config = app.get(ConfigService)
    for (const key of ['BRAND_NAME', 'BRAND_COLOR', 'BRAND_LOGO_URL']) assert.equal(config.get(key), projectIdentity[key], key)
    const { name, color, logoUrl } = app.get(MailService).brand
    assert.deepEqual({ name, color, logoUrl }, { name: projectIdentity.BRAND_NAME, color: projectIdentity.BRAND_COLOR, logoUrl: projectIdentity.BRAND_LOGO_URL })
  } finally {
    await app.close()
  }
})
