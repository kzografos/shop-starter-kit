# Hardening Implementation — 2026-09-19

What the "Hardening + Quality Gates" milestone changed, item by item. Findings and root causes are in [HARDENING-AUDIT.md](HARDENING-AUDIT.md).

## A1 — Malformed ids and Prisma errors

**Changes**
- [`common/filters/http-exception.filter.ts`](../backend/src/common/filters/http-exception.filter.ts): `Prisma.PrismaClientKnownRequestError` is mapped — `P2023` → `400 Invalid identifier`, `P2025` → `404 Not found`, `P2003` → `400 Related record not found`. Every other code (and every non-HTTP error) stays `500 Internal server error`; the Prisma message is logged, never returned.
- `ParseUUIDPipe` on every id parameter: `categories-admin` (`:id` ×2), `orders` (`:id` ×2), `orders-admin` (`:id`), `products-admin` (`:id` ×6; `:ref` is a storage key, not a UUID, and is untouched), `staff` (`:id` ×3). The notification controllers already had it.

**API behaviour change**: a malformed id now answers `400 Validation failed (uuid is expected)` instead of 500. Valid-but-unknown ids keep their existing 404s. Body-level UUIDs keep their DTO messages.

## A2 — Newsletter unsubscribe token

**Changes**
- [`newsletter/newsletter.service.ts`](../backend/src/newsletter/newsletter.service.ts): `unsubscribeToken(email)` = base64url(HMAC-SHA256(`JWT_SECRET`, `newsletter-unsubscribe:<email lowercased+trimmed>`)); `unsubscribe(email, token)` verifies with `timingSafeEqual` before touching the database and answers `403 Invalid unsubscribe link` on mismatch; `unsubscribeUrl(email)` builds the link for mails.
- [`newsletter/dto/unsubscribe.dto.ts`](../backend/src/newsletter/dto/unsubscribe.dto.ts) (new): `email` (IsEmail) + `token` (non-empty, ≤128) query DTO.
- [`newsletter/newsletter.controller.ts`](../backend/src/newsletter/newsletter.controller.ts): `DELETE /newsletter/unsubscribe` takes the DTO.
- [`mail/mail.service.ts`](../backend/src/mail/mail.service.ts): `sendWelcomeEmail(to, unsubscribeUrl)` — the caller supplies the link, so Infrastructure keeps no knowledge of the token.
- [`app/pages/unsubscribe.vue`](../app/pages/unsubscribe.vue): requires both `email` and `token` in the URL, sends both, shows the "invalid link" state on 400/403.

**Flow**: subscribe → welcome mail carries `/unsubscribe?email=…&token=…` → page shows a confirm-first screen (no request on load) → `DELETE` with both → `{ ok: true }`. A repeated click on the same link is a 200 no-op; an unknown address with a correctly formed token is also 200 (no existence leak). Tokens do not expire (an unsubscribe link must keep working); they become invalid only if `JWT_SECRET` changes.

**API behaviour change**: `token` is now required. Links from mails sent before this change no longer work (they show "invalid link"; the footer still allows subscribing again). Admin newsletter routes are unchanged.

**Security**: token is unguessable (256-bit HMAC), bound to one address, compared in constant time; the response never distinguishes "not subscribed" from "unsubscribed"; no schema change.

## A3 — Order creation idempotency

**Migration** `20260919100000_order_idempotency` (additive): `orders.idempotency_key TEXT NULL`, `orders.idempotency_hash TEXT NULL`, unique index `orders_idempotency_key_key` (NULLs not compared → existing orders and key-less requests unaffected). Rehearsed on a copy of the live database: 13 rows preserved, `migrate diff` empty afterwards.

**Key format and scope**: request header `Idempotency-Key`, 8–128 chars of `[A-Za-z0-9_-]` (400 otherwise). Stored as `user:<userId>:<key>` for signed-in buyers and `guest:<email lowercased>:<key>` for guests, so two buyers can use the same client key without colliding. The header is optional; requests without it behave exactly as before.

**Mechanism** ([`orders/orders.service.ts`](../backend/src/orders/orders.service.ts) `create`, `findIdempotentReplay`):
1. Digest = SHA-256 of the canonical (sorted-key) JSON of the validated DTO, with `guestEmail` normalised.
2. Before validation: if an order already holds the scoped key → same digest: return `{ id }` of that order (no side effects re-run); different digest: `409 Idempotency key was already used for a different order`.
3. The key and digest are written on the order row **inside the creation transaction**. A failed attempt (insufficient stock, bad points, any thrown error) rolls back and leaves the key free for a retry.
4. Concurrent duplicates: the second insert hits the unique index, its transaction (stock decrement, loyalty, items) rolls back, the `P2002` on `idempotency_key` is caught and the winning order is returned. Any other `P2002` propagates.
5. The two columns never leave the module: every order read that reaches a client uses `omit: ORDER_PRIVATE`.
- [`orders/orders.controller.ts`](../backend/src/orders/orders.controller.ts): reads and validates the header.
- [`app/pages/checkout/index.vue`](../app/pages/checkout/index.vue): one `crypto.randomUUID()` per attempt, regenerated whenever the cart, the form or the points to redeem change; sent as `Idempotency-Key`.

**Side-effect review**: stock decrement, loyalty redeem/earn and the CONFIRMED notification are all inside the transaction (once per committed order); the confirmation mail, analytics invalidation and stock alerts run only on the fresh path, never on a replay; Stripe checkout sessions are created by a separate call against the order id, so a replayed `POST /orders` cannot create a second session; the webhook is keyed by `ProcessedEvent` and unaffected.

## B1 — Redis in `/health`

- [`redis/redis.service.ts`](../backend/src/redis/redis.service.ts): `ping(timeoutMs = 2000)` — `PING` raced against a deadline; returns `false` on error or timeout (logged), never throws.
- [`health/redis.health.ts`](../backend/src/health/redis.health.ts) (new): Terminus indicator → `up` / `down { message: 'Redis did not answer PING' }`.
- [`health/health.controller.ts`](../backend/src/health/health.controller.ts): checks `database` and `redis`; Terminus answers `200 { status: 'ok' }` when both are up, `503 { status: 'error', info, error, details }` when either is down. Both are hard dependencies (Redis holds refresh and reset tokens), so there is no partial "degraded" verdict; component state is visible in `details`.
- `docker-compose.yml`, `docker-compose.prod.yml`: `healthcheck` on the backend service (`wget -qO- http://localhost:3001/health`, 30 s interval, 40 s start period).

**Security**: the body contains only component names, `up`/`down` and the fixed message — no URL, host, port, password or stack.

## B2 — Notification types in the admin inbox

- [`app/pages/admin/notifications/index.vue`](../app/pages/admin/notifications/index.vue): uses the shared `Notification` / `NotificationList` wire types from [`types/index.ts`](../types/index.ts) (`type` is `'low_stock' | 'out_of_stock' | 'order_status'`, keys snake_case); compares `n.type === 'out_of_stock'`; reads `total_pages`. Backend producer (`StockAlertsService` writes Prisma `OUT_OF_STOCK`) and serialisation (`SnakeCaseInterceptor` lowercases `type`) are unchanged — the frontend was the wrong end.

## B3 — Status-conditional `updateStatus`

- [`orders/orders.service.ts`](../backend/src/orders/orders.service.ts) `updateStatus`: the transition table (`order-status.ts`: PENDING→CONFIRMED|CANCELLED, CONFIRMED→PROCESSING|CANCELLED, PROCESSING→READY|CANCELLED, READY→COMPLETED|CANCELLED, COMPLETED/CANCELLED final) is unchanged. The write is now `updateMany({ where: { id, status: current } })` inside an interactive transaction with the customer notification; a race answers `409 Order changed while its status was being updated`. Cancellation still routes to `cancel()` (conditional since `a9a031d`), so restock and loyalty reversal happen exactly once and a repeated cancel is a 400.

## B4 — Dead code removed

- **Migration** `20260919110000_drop_refresh_tokens`: `DROP TABLE IF EXISTS "refresh_tokens"` (+ its FK). The table held 0 rows in the live database and no code referenced it (refresh tokens live in Redis). `RefreshToken` model and `User.refreshTokens` removed from `core.prisma`. Rehearsed: dropped, users intact, no drift.
- Deleted: `app/types/database.types.ts`, `app/pages/confirm.vue`, `app/pages/admin/products/[id].vue`, `app/plugins/stripe.client.ts`, `app/package.json`, `app/pnpm-lock.yaml`.
- `nuxt.config.ts`: private `runtimeConfig` (Stripe/Resend secrets, `emailFrom`) and `public.stripePublishableKey` removed; `@stripe/stripe-js` dropped from `optimizeDeps`.
- `package.json` / `pnpm-lock.yaml`: `@stripe/stripe-js`, `stripe`, `resend`, `zod` removed.
- `.env.example`, `docker-compose*.yml`, `README.md`: `STRIPE_PUBLISHABLE_KEY` removed (checkout is Stripe-hosted; the frontend never needed it).
- Docs: blueprint §8 env table, §9 dead row, §11/§13 dead-code list marked done; `AGENTS.md` database rule updated.

Kept on purpose: `EMAIL_FROM`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (backend reads them); `PETSHOPCY-MANUAL.md` (downstream reconciliation, current).

## A5 — Frontend quality gates

- `package.json`: `typecheck: nuxt typecheck`; devDependencies `vue-tsc ^3.3.11`, `eslint ^10.2.1`, `typescript` pinned explicitly (they were transitive).
- 22 type errors fixed: `~/types` → `~~/types` in four files (the alias never resolved, hiding 11 of them); `noUncheckedIndexedAccess` guards in `ProductDrawer`, `GuestAccountCTA`, `index.vue`, `AccountSidebar`, `AppHeader`, `layouts/admin.vue`; chart tick formatters typed to `vue-chrts`' `axisFormatter`; `@click` handlers that returned an assignment wrapped in arrow functions.
- 10 lint errors fixed: `Profile` wire type gains `permissions: string[]` and `role: string` (roles are module-fed since seam 3b), removing every `as any` in `usePermissions`, `layouts/admin.vue`, `admin/staff`; empty `catch {}` blocks carry a comment.
- `eslint.config.mjs`: ignores `backend/**` (separate toolchain, no ESLint config there) instead of the deleted `database.types.ts`.
- `.github/workflows/verify.yml`: new `frontend verify` job — `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`. No secrets: the two public runtime values have defaults. The backend job is unchanged.

**Local commands**: backend `cd backend && npm run verify`; frontend `pnpm lint && pnpm typecheck && pnpm build` from the root.

## Tests added (session harnesses, headless — see "deferred")

| Harness | Covers | Result |
|---|---|---|
| `h1-uuid.js` | 11 routes across orders/products/categories/staff: malformed → 400, unknown → 404, valid → 2xx; DTO UUIDs unchanged; filter mapping for P2023/P2025/P2003/P2002/P1001 and non-Prisma errors | 19/19 |
| `h2-newsletter.js` | valid token, wrong token, missing token, another address's token, tampered address, one-char variation, replay, unknown address, case-insensitive address, welcome-mail link | 14/14 |
| `h3-idempotency.js` | same key+payload (user), property order, different payload → 409, cross-user and guest scopes, 5 concurrent → 1 order, failed then retried, no key → old behaviour, header validation, Stripe order replay, columns hidden from payloads | 19/19 |
| `h4-health.js` | Redis down → 503 with plain message within the deadline, no secrets; Redis up → 200 | 6/6 |
| `h6-transitions.js` | all 36 (from, to) pairs, payment vocabulary → 404, concurrent conflicting moves, three identical moves, repeated cancel, response shape | 7/7 |
| `h9-ui.mjs` (browser) | unsubscribe page (no/wrong/valid token), checkout sends `Idempotency-Key` and the order stores it, admin inbox renders out-of-stock rows and pages | 16/16 |
| Regression: `nt1` 32/32, `nt2` 33/33, `cc-backend` 21/21, `ol2` 20/20, `ol3` 10/10, `nt3-ui` 34/34, `nt5-ui` 29/29 | notifications, order lifecycle, customer cancel, webhook expiry, bell, history page | all green |

## Verification results

| Command | Result |
|---|---|
| `backend: npm run verify` | typecheck ✓ · build ✓ · boundaries 0 new / 0 tracked ✓ · routes 65/65 (no route added or removed) ✓ · providers ✓ |
| `pnpm lint` | 0 errors, 37 warnings (pre-existing, non-failing) |
| `pnpm typecheck` | 0 errors (was 22) |
| `pnpm build` | ✓ |
| Migrations | both rehearsed on a copy of the live DB; `prisma migrate diff` empty; live DB `petshop` untouched |

## Intentionally deferred

- Frontend test runner (Vitest/Playwright) and porting the harnesses into the repo — Phase 4; the harnesses above are session-local.
- The 37 lint warnings (void-element self-closing, default props, one `v-html`).
- Dedicated `NEWSLETTER_SECRET` (currently derived from `JWT_SECRET`).
- Login lockout, order-idempotency for clients other than the checkout page, Redis-as-degraded semantics — roadmap B-items.
