#!/usr/bin/env node
/**
 * Optional-provider boot check (blueprint §8.1, ARCHITECTURE-DECISIONS D10).
 *
 * Proves that Core boots with only its required environment, that a
 * half-configured provider is rejected, that fully configured providers are
 * instantiated, and that a disabled provider fails with a clear 503 when used.
 *
 * Each scenario runs in its own child process because ConfigModule.forRoot()
 * validates the environment at import time of app.module — one process, one
 * environment. Nothing connects to a database, Redis, storage, mail or Stripe:
 * the app is composed (NestFactory.create) but never init()ed, and Redis is
 * given a lazyConnect URL.
 *
 *   node scripts/verify-providers.js            run every scenario
 *   node scripts/verify-providers.js --scenario core-only   (internal: child mode)
 *
 * Requires a prior `nest build`.
 */
'use strict'

const path = require('node:path')
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const assert = require('node:assert')

const BACKEND = path.resolve(__dirname, '..')
const DIST = path.join(BACKEND, 'dist')

// ── Environment definitions ─────────────────────────────────────
// Core: the only keys a Core-only boot needs.
const CORE = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://verify:verify@127.0.0.1:5432/verify',
  REDIS_URL: 'redis://127.0.0.1:6379/?lazyConnect=true',
  JWT_SECRET: 'verify-only-secret-not-for-use-0123456789ab',
  JWT_REFRESH_SECRET: 'verify-only-refresh-not-for-use-0123456789',
}
// Provider keys pinned to '' (= unset per env.validation.ts). Pinning is
// required: @prisma/client dotenv-loads backend/.env at require time and only
// fills keys that are absent, so an absent key could be filled from a local
// .env and silently enable a provider during the check.
const NONE = {
  MINIO_ENDPOINT: '', MINIO_ROOT_USER: '', MINIO_ROOT_PASSWORD: '', MINIO_BUCKET: '', MINIO_PUBLIC_URL: '',
  STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_CALLBACK_URL: '',
  MAIL_TRANSPORT: 'resend', RESEND_API_KEY: '', SMTP_HOST: '', EMAIL_FROM: '',
}
// Not pinned: SMTP_PORT and MINIO_PORT are Joi.number() and reject '' (they are
// only read when their provider is enabled). Leaving them unset is correct.
// Placeholder credentials: syntactically present, never used for a connection.
const FULL = {
  MINIO_ENDPOINT: '127.0.0.1', MINIO_PORT: '9000', MINIO_ROOT_USER: 'verify', MINIO_ROOT_PASSWORD: 'verify',
  MINIO_BUCKET: 'verify', MINIO_PUBLIC_URL: 'http://127.0.0.1:9000',
  STRIPE_SECRET_KEY: 'sk_test_verify_placeholder', STRIPE_WEBHOOK_SECRET: 'whsec_verify_placeholder',
  GOOGLE_CLIENT_ID: 'verify-client-id', GOOGLE_CLIENT_SECRET: 'verify-client-secret',
  MAIL_TRANSPORT: 'smtp',
}

const SCENARIOS = {
  'core-only': { ...NONE, ...CORE },
  'partial-minio': { ...NONE, ...CORE, MINIO_ENDPOINT: '127.0.0.1' },
  'partial-google': { ...NONE, ...CORE, GOOGLE_CLIENT_ID: 'verify-client-id' },
  'partial-stripe': { ...NONE, ...CORE, STRIPE_SECRET_KEY: 'sk_test_verify_placeholder' },
  full: { ...NONE, ...CORE, ...FULL },
  resend: { ...NONE, ...CORE, MAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_verify_placeholder' },
}

// ── Child: one scenario ─────────────────────────────────────────
async function runScenario(name) {
  const { ServiceUnavailableException } = require('@nestjs/common')
  const { NestFactory } = require('@nestjs/core')
  const { AppModule } = require(path.join(DIST, 'app.module.js'))
  const expectPartialRejection = name.startsWith('partial-')

  const is503 = (e) => e instanceof ServiceUnavailableException
  async function expect503(fn, label) {
    try {
      await fn()
    } catch (e) {
      assert(is503(e), `${label}: expected ServiceUnavailableException, got ${e && e.message}`)
      console.log(`   ${label} → 503 "${e.message}"`)
      return
    }
    throw new Error(`${label}: did not throw`)
  }

  let app
  try {
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false })
  } catch (e) {
    const msg = String(e && e.message ? e.message : e).split('\n')[0]
    if (expectPartialRejection && /Config validation error/.test(msg)) {
      console.log(`   boot rejected as expected: ${msg.slice(0, 160)}`)
      return
    }
    throw new Error(`boot failed: ${msg}`)
  }
  if (expectPartialRejection) throw new Error('partial provider configuration was accepted')

  const get = (rel, cls) => app.get(require(path.join(DIST, rel))[cls])
  const minio = get('minio/minio.service.js', 'MinioService')
  const payments = get('payments/payments.service.js', 'PaymentsService')
  const mail = get('mail/mail.service.js', 'MailService')
  const { GoogleStrategy } = require(path.join(DIST, 'auth/strategies/google.strategy.js'))
  const google = app.get(GoogleStrategy)
  const guard = get('auth/guards/google-auth.guard.js', 'GoogleAuthGuard')
  const uploads = get('uploads/uploads.service.js', 'UploadsService')

  console.log(`   booted; storage=${minio.isEnabled} payments=${payments.isEnabled} mail=${mail.isEnabled} google=${google ? google.constructor.name : null}`)

  if (name === 'core-only') {
    assert.strictEqual(minio.isEnabled, false, 'storage must be disabled')
    assert.strictEqual(payments.isEnabled, false, 'payments must be disabled')
    assert.strictEqual(mail.isEnabled, false, 'mail must be disabled')
    assert.strictEqual(google, null, 'google strategy must not be registered')
    await expect503(() => minio.getPresignedUrl('key', 60), 'minio.getPresignedUrl')
    await expect503(
      () => uploads.uploadImage({ size: 12, buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), mimetype: 'image/jpeg', originalname: 'a.jpg' }),
      'uploads.uploadImage',
    )
    await expect503(() => payments.verifySession('cs_verify', null), 'payments.verifySession')
    await expect503(() => payments.handleWebhook(Buffer.from(''), 'sig'), 'payments.handleWebhook')
    await expect503(async () => guard.canActivate({}), 'GoogleAuthGuard.canActivate')
    await mail.sendPasswordReset('verify@example.invalid', 'token') // resolves; send error is logged
    console.log('   mail.sendPasswordReset → resolved (send failure logged, not thrown)')
  }
  if (name === 'full') {
    assert.strictEqual(minio.isEnabled, true, 'storage must be enabled')
    assert.strictEqual(payments.isEnabled, true, 'payments must be enabled')
    assert.strictEqual(mail.isEnabled, true, 'mail (smtp) must be enabled')
    assert(google instanceof GoogleStrategy, 'google strategy must be registered')
    assert.strictEqual(google.name, 'google')
  }
  if (name === 'resend') {
    assert.strictEqual(mail.isEnabled, true, 'mail (resend) must be enabled')
    assert.strictEqual(minio.isEnabled, false)
    assert.strictEqual(payments.isEnabled, false)
  }
  await app.close()
}

// ── Parent: orchestrate ─────────────────────────────────────────
function main() {
  const scenarioArg = process.argv.indexOf('--scenario')
  if (scenarioArg >= 0) {
    const name = process.argv[scenarioArg + 1]
    runScenario(name)
      .then(() => { console.log('   OK'); process.exit(0) })
      .catch((e) => { console.log(`   FAIL: ${e.message}`); process.exit(1) })
    return
  }

  if (!fs.existsSync(path.join(DIST, 'app.module.js'))) {
    console.error('verify-providers: dist/app.module.js not found — run `npm run build` first')
    process.exit(2)
  }

  let failed = 0
  for (const [name, env] of Object.entries(SCENARIOS)) {
    console.log(name)
    const r = spawnSync(process.execPath, [__filename, '--scenario', name], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      cwd: BACKEND,
    })
    const lines = (r.stdout || '').split(/\r?\n/).filter((l) => l.startsWith('   '))
    process.stdout.write(lines.join('\n') + '\n')
    if (r.status !== 0) {
      failed++
      const err = (r.stderr || '').split(/\r?\n/).filter((l) => /Error|FAIL/.test(l)).slice(0, 3).join('\n')
      if (err) console.log(err)
    }
  }
  if (failed) {
    console.error(`verify-providers: ${failed} scenario(s) failed`)
    process.exit(1)
  }
  console.log('verify-providers: OK — all scenarios passed')
}

main()
