// Project identity (Phase 3.1, 3.2). The committed src/project.identity.ts
// matches its sources, a stale copy or a missing source value fails loudly, the
// values the composition root loads win over the same keys in the environment —
// the @nestjs/config 4.x precedence this design relies on — and the checkout
// sends the project currency.
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

const business = "export const BUSINESS = { name: 'Fixture Shop', brand: { logo: null as string | null } }\n"
const withCurrency = (currency) => `${business}export const REGION = { currency: ${JSON.stringify(currency)} }\n`
const CONFIG = withCurrency('EUR')
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
    assert.match(generated, /BRAND_NAME: "Fixture Shop",\n {2}BRAND_COLOR: "#123456",\n {2}BRAND_LOGO_URL: "",\n {2}PROJECT_CURRENCY: "EUR",/)
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

test('REGION.currency must be three uppercase letters; its minor-unit rules are not the generator\'s concern', () => {
  const cases = [
    [business, /exports no REGION object/],
    [`${business}export const REGION = {}\n`, /REGION\.currency must be a three-letter uppercase currency code, got undefined/],
    [withCurrency(''), /got ""/],
    [withCurrency('eur'), /got "eur"/],
    [withCurrency('EU'), /got "EU"/],
    [withCurrency('EURO'), /got "EURO"/],
  ]
  for (const [config, message] of cases) {
    withFixture({ config, css: CSS }, (f) => {
      const r = run(f.script)
      assert.equal(r.status, 1, config)
      assert.match(r.stderr, message)
      assert.equal(existsSync(f.target), false)
    })
  }
  // A zero-decimal currency is emitted as configured: amounts are the
  // payments domain's concern, not this generator's.
  withFixture({ config: withCurrency('JPY'), css: CSS }, (f) => {
    assert.equal(run(f.script).status, 0)
    assert.match(readFileSync(f.target, 'utf8'), /PROJECT_CURRENCY: "JPY",/)
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

// The composed application from dist/, under the stub environment of
// verify-providers (Core keys satisfy the schema, no provider is configured,
// Redis is lazy — nothing connects), with a competing value in the environment
// for every loaded key. ConfigModule validates at import time, so the
// environment is set before app.module is first required.
async function composeApp() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://verify:verify@127.0.0.1:5432/verify',
    REDIS_URL: 'redis://127.0.0.1:6379/?lazyConnect=true',
    JWT_SECRET: 'verify-only-secret-not-for-use-0123456789ab',
    JWT_REFRESH_SECRET: 'verify-only-refresh-not-for-use-0123456789',
    MINIO_ENDPOINT: '', STRIPE_SECRET_KEY: '', GOOGLE_CLIENT_ID: '', MAIL_TRANSPORT: 'resend', RESEND_API_KEY: '',
    BRAND_NAME: 'From The Environment', BRAND_COLOR: '#000000', BRAND_LOGO_URL: 'https://env.invalid/logo.png',
    PROJECT_CURRENCY: 'USD',
  })
  const { NestFactory } = require('@nestjs/core')
  const { AppModule } = require('../dist/app.module.js')
  return NestFactory.create(AppModule, { logger: false, abortOnError: false })
}
const { projectIdentity } = require('../dist/project.identity.js')

test('the loaded project identity wins over the same keys in the environment', async () => {
  const { ConfigService } = require('@nestjs/config')
  const { MailService } = require('../dist/infrastructure/mail/mail.service.js')
  const app = await composeApp()
  try {
    const config = app.get(ConfigService)
    for (const key of ['BRAND_NAME', 'BRAND_COLOR', 'BRAND_LOGO_URL', 'PROJECT_CURRENCY']) assert.equal(config.get(key), projectIdentity[key], key)
    const { name, color, logoUrl } = app.get(MailService).brand
    assert.deepEqual({ name, color, logoUrl }, { name: projectIdentity.BRAND_NAME, color: projectIdentity.BRAND_COLOR, logoUrl: projectIdentity.BRAND_LOGO_URL })
  } finally {
    await app.close()
  }
})

test('the checkout sends the project currency, lowercased, and the same minor-unit amounts', async () => {
  const { ConfigService } = require('@nestjs/config')
  const { PaymentsService } = require('../dist/modules/ecommerce/payments/payments.service.js')
  const app = await composeApp()
  try {
    // The e-commerce service is composed only when its module is enabled, and
    // this must hold either way, so it is built directly: with the composed
    // application's own ConfigService (Core, always present) and only its
    // database and provider replaced — createCheckoutSession uses nothing else.
    // Constructor order: prisma, provider, mail, pricing, loyalty, orders,
    // orderNotifications, analytics, config.
    let sent
    const prisma = {
      order: {
        findUnique: async () => ({
          id: 'ord-1', userId: 'u-1', paymentMethod: 'STRIPE', shippingCost: '5.00', loyaltyDiscount: '2.505',
          items: [
            { unitPrice: '12.345', quantity: 2, product: { nameEn: 'Alpha' } },
            { unitPrice: '0.1', quantity: 3, product: { nameEn: 'Beta' } },
            { unitPrice: '19.99', quantity: 1, product: null },
          ],
        }),
        update: async () => ({}),
      },
    }
    const provider = { isEnabled: true, assertEnabled() {}, createCheckout: async (input) => { sent = input; return { id: 'cs_1', url: 'https://pay.invalid/cs_1' } } }
    const payments = new PaymentsService(prisma, provider, undefined, undefined, undefined, undefined, undefined, undefined, app.get(ConfigService))

    await payments.createCheckoutSession('ord-1', 'u-1', 'https://site.invalid/ok', 'https://site.invalid/cancel')
    assert.equal(sent.currency, projectIdentity.PROJECT_CURRENCY.toLowerCase())
    assert.deepEqual(sent.lines.map((l) => [l.name, l.unitAmountMinor, l.quantity]), [
      ['Alpha', 1235, 2], ['Beta', 10, 3], ['Product', 1999, 1], ['Shipping', 500, 1],
    ])
    assert.equal(sent.discountMinor, 251)
  } finally {
    await app.close()
  }
})
