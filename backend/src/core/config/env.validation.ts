import * as Joi from 'joi'
import type { ConfigService } from '@nestjs/config'

/**
 * Environment contract (ARCHITECTURE-BLUEPRINT §8, DEPENDENCY-RULES §6.2).
 *
 * Core boot needs only the first block. Every provider block is optional: its
 * variables are validated only when the block's "presence" key is set, so a
 * half-configured provider still fails loudly while an absent one is simply
 * disabled. The isXConfigured() helpers are the single source of truth the
 * provider modules use to decide whether to instantiate an SDK client.
 *
 * Empty strings count as "not set" because docker-compose forwards unset
 * variables as `` (e.g. GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}).
 */

// '' is normalised to undefined (empty()), so "set" means "non-empty".
const optional = () => Joi.string().empty('')
const present = Joi.string().min(1).required()
const requiredWhen = (key: string) => optional().when(key, { is: present, then: Joi.required() })

// ── Core: required for every boot ─────────────────────────────
const core = {
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
}

// ── Optional: object storage (MinIO / S3-compatible) ──────────
const storage = {
  MINIO_ENDPOINT: optional(),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ROOT_USER: requiredWhen('MINIO_ENDPOINT'),
  MINIO_ROOT_PASSWORD: requiredWhen('MINIO_ENDPOINT'),
  MINIO_BUCKET: requiredWhen('MINIO_ENDPOINT'),
  MINIO_PUBLIC_URL: requiredWhen('MINIO_ENDPOINT'),
}

// ── Optional: payments (Stripe) ───────────────────────────────
const payments = {
  STRIPE_SECRET_KEY: optional(),
  STRIPE_WEBHOOK_SECRET: requiredWhen('STRIPE_SECRET_KEY'),
}

// ── Optional: Google OAuth ────────────────────────────────────
const google = {
  GOOGLE_CLIENT_ID: optional(),
  GOOGLE_CLIENT_SECRET: requiredWhen('GOOGLE_CLIENT_ID'),
  GOOGLE_CALLBACK_URL: optional(),
}

// ── Optional: mail transport ──────────────────────────────────
// smtp needs no credentials (dev catcher); resend needs an API key. Neither
// is required to boot — MailService reports itself disabled when unusable.
const mail = {
  MAIL_TRANSPORT: Joi.string().empty('').valid('smtp', 'resend').default('resend'),
  RESEND_API_KEY: optional(),
  SMTP_HOST: optional(),
  SMTP_PORT: Joi.number(),
}

export const envValidationSchema = Joi.object({
  ...core,
  ...storage,
  ...payments,
  ...google,
  ...mail,
})

// ── Runtime presence checks (mirror the Joi conditions above) ─
const has = (config: ConfigService, key: string) => Boolean(config.get<string>(key))

export const isStorageConfigured = (config: ConfigService) => has(config, 'MINIO_ENDPOINT')
export const isPaymentsConfigured = (config: ConfigService) => has(config, 'STRIPE_SECRET_KEY')
export const isGoogleAuthConfigured = (config: ConfigService) => has(config, 'GOOGLE_CLIENT_ID')
export const isMailConfigured = (config: ConfigService) =>
  config.get<string>('MAIL_TRANSPORT', 'resend') === 'smtp' || has(config, 'RESEND_API_KEY')
