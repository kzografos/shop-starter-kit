# Architecture Audit — 2026-09-18

Audit of `shop-starter-kit` at commit `a49b4c6` (branch `phase-1-clean-ground`, 193 commits). Read-only: no application behaviour was changed. Companion documents: [PROGRESS-AUDIT.md](PROGRESS-AUDIT.md) (feature inventory and completion) and [REMAINING-ROADMAP.md](REMAINING-ROADMAP.md) (what is left and in which order).

Method: every backend module, controller, service, Prisma schema file, migration, script and Docker/Nginx file was read; every frontend page, component, composable, store, plugin, middleware and both locale files were read; the route inventory (65 routes), the boundary map and the three verification scripts were executed; findings from the two previous audits (notifications, order lifecycle) were re-checked against the current tree.

Size: backend 5,051 lines of TypeScript across 22 modules; frontend 9,680 lines across 32 pages, 23 components, 11 composables, 4 stores; 496 i18n keys per locale (EL/EN, in parity); 15 migrations in one linear history; 65 HTTP routes.

---

## 1. Verdict in one paragraph

The architecture is healthy and the blueprint's Phase 1 is genuinely finished: every seam in blueprint §11 is cut, the boundary baseline is empty, the verification gate (`npm run verify`) enforces it, and the last six feature commits (media, order lifecycle, notifications) were built *inside* the rules without a single boundary exception. The stack (Nuxt 4 + NestJS 11 + PostgreSQL + Redis + MinIO + Stripe) is appropriate and is used the way it should be. There is no blocker to continuing. What remains is (a) a small set of security/robustness fixes that should land before any new module, (b) the Phase 2 layout and registry work that the blueprint already schedules, and (c) the quality gates (tests, frontend typecheck/lint in CI) that Phase 4 promises but nothing enforces today.

---

## 2. Structure and module boundaries

### 2.1 Backend layout

Flat `backend/src/<module>/` folders; the target `core/`, `modules/ecommerce/`, `infrastructure/` folders do not exist yet. The mapping is enforced by [`backend/scripts/verify-boundaries.js`](../backend/scripts/verify-boundaries.js) (layer map lines 32–34):

| Layer | Folders |
|---|---|
| Infrastructure | `prisma`, `redis`, `storage`, `payments-provider`, `mail`, `health`, `common` |
| Core | `core`, `auth`, `users`, `profile`, `staff`, `settings`, `notifications`, `newsletter`, `uploads` |
| Shop (module) | `products`, `categories`, `favourites`, `orders`, `payments`, `loyalty`, `analytics` |

Result of the gate at `a49b4c6`: **0 violations, 0 baseline entries**. No Core or Infrastructure file imports a shop folder; no Core controller requires a shop capability; no Core service touches a shop Prisma model. Verified by reading, not only by the script: `auth`, `users`, `profile`, `settings`, `notifications`, `mail`, `storage` reference only Core/Infra models and services.

### 2.2 Core ↔ shop separation — what is clean

- **Events**: `CoreEventBus` (`core/events/`) with one typed event `user.authenticated`; the shop's `GuestOrderLinkerService` subscribes. Core never names a module.
- **Registries** (all module-fed, boot-time validated): capabilities + role presets (`auth/permissions.registry.service.ts`), settings definitions (`settings/setting-definition.ts`), user extensions (`users/user-extensions.registry.ts`). Shop contributes from `products/catalog-permissions.ts`, `orders/orders-permissions.ts`, `analytics/analytics-permissions.ts`, `orders/pricing-settings.ts`, `loyalty/loyalty-user.extension.ts`, `orders/orders-user.extension.ts`.
- **Adapters** (D7): `StorageAdapter`/`MinioStorageAdapter`, `PaymentProvider`/`StripePaymentProvider`, `MailService` with SMTP/Resend transports. Each optional, each 503 when unconfigured, each with one implementation.
- **Notifications**: Core owns rows, unread counters and both inboxes; the only rule that decides *when* to notify lives in the modules (`products/stock-alerts.service.ts`, `orders/order-notifications.service.ts`).
- **Frontend shells**: `layouts/default.vue`, `AppHeader`, `AccountSidebar`, `account/index.vue` render `app.config` contribution lists (`navItems`, `headerActions`, `globalWidgets`, `accountItems`, `accountCards`) by registered component name. No shop import in a shell.
- **Schema**: three Prisma files by ownership (`core`, `infrastructure`, `ecommerce`); `User` carries no domain scalar; module back-relations are declared in the module file.

### 2.3 Where shop logic still leaks into Core (frontend only)

| Leak | Location | Severity |
|---|---|---|
| Admin shell hard-codes shop sections (Analytics, Products, Categories, Orders) as nav buttons and `isProducts/isCategories/isAnalytics` computeds | [`app/layouts/admin.vue:18-75`](../app/layouts/admin.vue#L18-L75), [`:185-192`](../app/layouts/admin.vue#L185-L192) | Important — this is the Phase 2 **Admin Registry** gap |
| `usePermissions.SECTION_CAPS` and `LANDING_ORDER` hard-code `view:finance`, `view:catalog`, `view:orders` and their admin paths | [`app/composables/usePermissions.ts:8-28`](../app/composables/usePermissions.ts#L8-L28) | Important — same registry gap |
| `STAFF_ROLES` duplicated on the client (`admin`, `accountant`, `stock_manager`) | [`usePermissions.ts:30`](../app/composables/usePermissions.ts#L30) | Nice-to-have — `/profile` could expose `is_staff` |
| Admin settings form hard-codes the five pricing keys | `app/pages/admin/settings/index.vue` | Important — Settings Registry gap (blueprint seam 4 residue) |
| `prisma/seed.ts` hard-codes the five pricing keys | [`backend/prisma/seed.ts:30`](../backend/prisma/seed.ts#L30) | Nice-to-have — Phase 3 registry-driven seed |
| `AppFooter` hard-codes shop links; `HeaderSearch` reads Core key `header.search_placeholder` | `app/components/layout/AppFooter.vue`, `app/components/filters/HeaderSearch.global.vue` | Nice-to-have (seam 9 residue, documented) |
| Order-status wording lives in Core's `useCustomerNotifications.describe()` | [`app/composables/useCustomerNotifications.ts:106-121`](../app/composables/useCustomerNotifications.ts#L106-L121) | Nice-to-have — becomes a per-module presenter registry once a second notification type exists |

Backend: **no leak found.** The `orders-permissions.ts` file hosting the shop role presets is the documented interim home until an `ecommerce.module.ts` root exists.

### 2.4 Supabase residue

Nothing functional. Dead artefacts only, all listed in blueprint §13 Phase 1 and awaiting explicit approval to delete:

- `app/types/database.types.ts` — 496 generated Supabase types, zero importers.
- `app/pages/confirm.vue` (21 lines) — Supabase email-confirm landing.
- `app/pages/admin/products/[id].vue` (11 lines) — empty stub.
- `nuxt.config.ts` `runtimeConfig.stripeSecretKey / stripeWebhookSecret / resendApiKey / emailFrom` — server-side secrets declared in the **frontend** runtime config, unused since the NestJS move. Not exposed to the browser (private block) but they invite the wrong mental model and keep `stripe`/`resend`/`zod` as root dependencies.
- `plugins/stripe.client.ts` `$stripe` provide — unused (checkout redirects to Stripe-hosted pages).
- `RefreshToken` Prisma model — dead (tokens live in Redis), still in `core.prisma` with a `User.refreshTokens` back-relation.
- `app/package.json` (a stray `@nuxt/image` dependency) and stale `.nuxt` folders.

---

## 3. Frontend / backend architecture

- **Contract**: JSON over HTTP, `SnakeCaseInterceptor` converts camelCase → snake_case and lowercases enum fields on the wire (D9). Frontend types in `types/index.ts` mirror the wire shape. Consistent everywhere.
- **HTTP client**: `useApi()` is the single door — base URL, `credentials: 'include'`, single-flight 401 → `/auth/refresh` → retry, `api:unauthenticated` hook (no store import; the `useApi ↔ useAuthStore` cycle is gone).
- **Violation**: 44 raw `$fetch` references in 21 files bypass `useApi` — heaviest in [`ProductDrawer.vue`](../app/components/admin/ProductDrawer.vue) (8), [`admin/staff/index.vue`](../app/pages/admin/staff/index.vue) (5), [`admin/categories/index.vue`](../app/pages/admin/categories/index.vue) (4), [`admin/notifications/index.vue`](../app/pages/admin/notifications/index.vue) (3), then two each in `admin/orders`, `admin/products`, `admin/settings`, `checkout/index.vue`, `products/[slug].vue`, `index.vue`, `ProductFilters.vue`, and one each in the remaining admin pages, `brands.vue`, `products/index.vue`, `checkout/cancel.vue`, `useProducts.ts`, `useAdminNotifications.ts`, `AppFooter.vue`. None carries the `// raw-fetch:` justification AGENTS.md requires. Public catalogue reads are harmless; the admin and checkout calls skip the refresh-and-retry, so an expired access token in the admin panel or at checkout surfaces as a failed action instead of a transparent refresh.
- **SSR**: pages render on the server; session-gated pages defer the auth decision to the client (documented in `middleware/auth.ts`). `auth.server.ts` fetches the profile server-side when cookies are present. Pre-existing hydration warnings on session-dependent header elements (profile is `skipHydrate`) — cosmetic, known.
- **State**: setup-style Pinia stores (`auth`, `cart` persisted, `favourites`, `filters`); shared `useState` keys namespaced (`cart-open`, `customer-notif-*`, `admin-notif-unread`) behind composables.
- **Routing/i18n**: `@nuxtjs/i18n` `prefix_except_default`, default `el`; every user-facing string keyed; EL/EN in parity (496/496).

---

## 4. Authentication and authorization

Implementation read in full ([`auth.service.ts`](../backend/src/auth/auth.service.ts), [`jwt.strategy.ts`](../backend/src/auth/strategies/jwt.strategy.ts), [`permissions.guard.ts`](../backend/src/auth/guards/permissions.guard.ts), [`permissions.registry.service.ts`](../backend/src/auth/permissions.registry.service.ts)).

| Aspect | State |
|---|---|
| Credentials | bcrypt cost 12; `Invalid credentials` for both unknown email and wrong password |
| Access token | JWT 15 min, httpOnly `SameSite=Lax` cookie (also accepted as Bearer); `secure` only in production |
| Refresh token | JWT 7 d with `jti`; **stored in Redis** (`refresh:<userId>:<jti>`), single-use rotation on `/auth/refresh`, all sessions revoked on logout and on password reset; `/auth/refresh` throttled 3/min |
| Per-request authorization | `JwtStrategy.validate` **reloads the user from the DB** — role changes and deletions take effect immediately; the `role` claim in the token is informational only |
| Capabilities | `RequirePermissions(...caps)`: all required; owner (`admin`) bypasses; a Core controller with no capability is owner-only. Registry rejects duplicate capability ids and presets naming unknown capabilities at boot |
| Google OAuth | passport-google; known id → login, same email → auto-link, else create passwordless account; strategy instantiated only when configured (503 otherwise). Frontend still renders the Google button unconditionally |
| Password reset | one-time UUID token in Redis, 1 h TTL, generic 200 for unknown email, throttled 3/min; resets revoke every session |
| Not present | email verification, 2FA, account lockout / progressive delays, session listing, password-change-while-logged-in endpoint (only reset-by-mail and admin reset of staff) |

Guard coverage per route is snapshotted in [`route-inventory.snapshot.txt`](../backend/scripts/route-inventory.snapshot.txt) and diffed by CI; every `/admin/*` route carries `JwtAuthGuard + PermissionsGuard + capability`; every customer-private route carries `JwtAuthGuard` and scopes by `user.id` in the service (orders, favourites, notifications, profile, loyalty — verified in the previous two audits and re-read here).

---

## 5. Database and migrations

- PostgreSQL via Prisma 6, multi-file schema (`prisma/core.prisma`, `infrastructure.prisma`, `ecommerce.prisma`), `migrations/` beside them, `--schema prisma` everywhere (`start.sh`, scripts).
- 15 migrations, linear, three of them hand-written and data-preserving (`user_role_enum_to_text`, `loyalty_account`, `per_user_notifications`) with rehearsals recorded in the commit history. `migrate diff` and history-vs-schema (shadow DB) were clean at the last schema change.
- Ownership: `User`, `Setting`, `NewsletterSubscriber`, `Notification` (+ `RefreshToken`, dead) in Core; `ProcessedEvent` in Infrastructure; `Category`, `Product`, `Order`, `OrderItem`, `LoyaltyAccount`, `LoyaltyTransaction`, `Favourite` in e-commerce. `User.role` is `text` (D4); no `UserRole` enum.
- Invariants that matter and hold: `Order.user` `onDelete: SetNull` (orders survive account deletion); `Notification.user` `onDelete: Cascade`; `LoyaltyAccount` 1:1 with `User`; unique `Notification.key`; `ProcessedEvent.eventId` primary key.
- Indexes: adequate for current volume. Known gaps recorded in the notifications audit: `notifications (user_id, created_at DESC)` composite; no retention/purge for read notifications.
- Localisation: column-per-locale (`nameEl`/`nameEn`, `descriptionEl`/`descriptionEn`) on `Product`/`Category` — 28 inline `locale === 'el'` ternaries on the frontend. Documented risk (blueprint §14.1, D5); a `useLocalized()` helper is the agreed first step and is not written.
- Deployment: `start.sh` runs `migrate deploy` then the seed on every container start; the seed is idempotent (upserts), demo data only with `SEED_DEMO_DATA=true`, owner bootstrapped from `OWNER_EMAIL`/`OWNER_PASSWORD` with a length check and a loud warning to remove the variables afterwards.

---

## 6. Redis

Single `RedisService` over ioredis with `get/set(ttl)/del/exists/delPattern(scan)`. Every `set` has an explicit TTL (checked: refresh tokens 7 d, reset tokens 1 h, products 30–60 s, categories tree, analytics 300 s, settings, unread counters 30 s). Cache owners expose `invalidate()`; no cross-module pattern deletes (seam 8).

Two things to know:

1. **All Redis errors are swallowed as warnings** ([`redis.service.ts`](../backend/src/redis/redis.service.ts)). For caches that is right. For the refresh-token store it means: Redis down → `set` silently fails at login → the refresh token is unusable → the user is logged out after 15 minutes; `exists` returns `false` → refresh is refused. Fail-closed, so not a security issue, but a Redis outage looks like "everyone keeps getting logged out" and nothing but a WARN line says why. Worth a health indicator (see §10).
2. `delPattern` uses `SCAN` + pipeline — safe on a shared instance; `analytics:*` and `products:*` are the only patterns.

---

## 7. File storage and uploads

- `StorageAdapter` (Infrastructure) with `isEnabled/put/resolve/presign/remove`; MinIO implementation; presigned reads (3600 s) with `MINIO_PUBLIC_URL` rewrite; absolute external URLs pass through untouched and are never deleted.
- `POST /uploads/image` (Core, `manage:media`): 5 MB cap, **magic-byte sniffing** via `file-type` plus a mimetype whitelist (JPEG/PNG/WebP/GIF). Good.
- Product images are a sub-resource of the product (`POST/PATCH order/DELETE :ref`), `Product.images[]` is the truth (index 0 = primary), objects are deleted only when no product references them.
- Gaps: no image resizing/variants (originals are served), no per-user upload quota, Nginx `/media/` proxy block is unconditional even when storage is disabled (documented residue).

---

## 8. Webhooks and idempotency

[`payments.service.ts`](../backend/src/payments/payments.service.ts): signature verification is the provider's (`parseWebhook`, 400 on bad signature, 503 unconfigured). `checkout.session.completed` is applied in **one batch transaction whose first write is the `ProcessedEvent` insert** — a redelivery hits the primary key, the whole batch rolls back, the handler answers 200. Amount-mismatch, already-paid and already-cancelled orders are logged and ignored (cancelled → "refund manually" warning). `checkout.session.expired` releases stock through the single `OrdersService.cancel()` path (status-conditional `updateMany`, so concurrent deliveries cannot double-restock) and records the `ProcessedEvent` afterwards. Verified again in this session's harnesses (concurrent deliveries, redelivery, staff-preconfirmed order).

Stripe idempotency keys are used on coupon and session creation. Order creation itself has no client idempotency key (a double-submitted checkout form creates two orders) — see roadmap.

---

## 9. Validation, error handling, logging, security

| Area | State | Notes |
|---|---|---|
| Input validation | Global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, class-validator DTOs on every body | Path params: `ParseUUIDPipe` only on the notification routes; every other `:id` route (orders, products admin, categories, staff, favourites) turns a malformed UUID into a **500** via a Prisma cast error |
| Error filter | `GlobalExceptionFilter`: `HttpException` passthrough, everything else → generic `Internal server error` + stack logged | Prisma known errors are not mapped (`P2025` not-found → 500) |
| Logging | `nestjs-pino`, pretty in dev, `req.headers.cookie` and `authorization` redacted | Request bodies are not logged; no request id propagation to the frontend |
| Headers/CORS | `helmet()`; CORS credentialed, dev regex `localhost:*`, prod allow-list from `NUXT_URL` | Nginx adds `X-Frame-Options`, `nosniff`, HSTS, `Referrer-Policy` |
| Rate limiting | Nest throttler 100/min global; 3/min on `/auth/refresh` and `/auth/forgot-password`; Nginx 600 r/m API, 10 r/m `/api/auth/` | `/auth/login` and `/auth/register` rely on the global and Nginx limits only — no per-account lockout |
| CSRF | Cookies `SameSite=Lax` + CORS allow-list + JSON bodies | Adequate for same-site deployment behind Nginx; no double-submit token |
| Secrets | `.env` untracked; Joi contract with optional provider blocks; providers off when unconfigured; `process.env` read at import time only in `main.ts` (CORS/port) and `COOKIE_OPTS.secure` | `runtimeConfig` in `nuxt.config.ts` still names Stripe/Resend secrets (dead, §2.4) |
| Newsletter | `POST /newsletter/subscribe` public (200 idempotent); **`DELETE /newsletter/unsubscribe?email=` public with no token** — anyone can unsubscribe any address; no double opt-in; welcome mail on first subscribe | Roadmap A |
| Uploads | see §7 | — |
| Seed | demo accounts (`admin@demo.com`/`admin`) only behind `SEED_DEMO_DATA=true`, warned loudly | — |

---

## 10. Docker, Nginx, environment

- `docker-compose.yml` (dev: postgres 16, redis 7 with password, minio, mailpit, backend, nuxt, nginx behind a profile) + `docker-compose.prod.yml` (NODE_ENV=production, no dev ports) + `docker-compose.override.yml` (moves Nginx behind `with-nginx`).
- Backend image: multi-stage (`deps → builder → runner`), `prisma generate`, seed compiled, `start.sh` migrates + seeds + `exec node dist/main`. Nuxt image `Dockerfile.nuxt`.
- Nginx: HTTP→HTTPS, TLS from mounted certs, security headers, `client_max_body_size 10M`, rate zones, `/api/` → backend, `/api/auth/` stricter, `/media/` → MinIO, `/health` passthrough.
- Env contract: Joi (`core/config/env.validation.ts`) — `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`/`JWT_REFRESH_SECRET` (min 32) required; MinIO / Stripe / Google / mail blocks conditional. `.env.example` ships `MAIL_TRANSPORT=smtp` so Mailpit catches mail locally.
- Gaps: `minio/minio:latest` and `axllent/mailpit:latest` unpinned; `/health` checks only Postgres (no Redis, MinIO or mail indicators); no backup, TLS-renewal or log-rotation automation (explicitly deferred in blueprint §14.2); `docker-compose` Postgres/Redis publish ports in dev only.

---

## 11. Dependency direction and cycles

- Nest module graph: `Payments → Orders → Products/Settings/Users/Loyalty/Analytics/Notifications`; `Products → Notifications/Uploads`; `Categories → Products`; Core modules import only Prisma/Redis/Mail/Storage/Permissions. **No circular Nest module imports** (a cycle would fail `verify:routes`, which composes the DI graph without `init()`).
- The only shared-service "reach across" between shop sub-domains is through exported services (`OrdersService`, `LoyaltyService`, `ProductsService`, `StockAlertsService`, `OrderNotificationsService`), never via another module's Prisma models — checked with `grep` for `prisma.<foreignModel>` per folder.
- Frontend: `useApi` has no store import; stores do not import components; the shells import nothing shop-specific. The `admin.vue` layout / `usePermissions` coupling in §2.3 is a *knowledge* dependency (hard-coded paths/caps), not an import cycle.

---

## 12. Scalability and maintainability

- Read paths are cached (products 30–60 s, categories, analytics 5 min, settings, unread counters) and every write path invalidates its owner's namespace.
- Order creation, cancellation, settlement and loyalty are transactional with status-conditional writes; the 409 on a racing cancel is tested. `updateStatus` is not status-conditional (last-write-wins between two staff moves) — pre-existing, low impact.
- Lists are paginated (products 12, orders admin, notifications 20, customers). Analytics aggregates over all orders per request window and caches 5 min — fine until tens of thousands of orders.
- Maintainability risks: the two largest files (`orders.service.ts` 501 lines, `analytics.service.ts` 378) are still readable; the 28 locale ternaries and the hard-coded admin nav are the main "every change touches many places" costs.
- **Test debt is the largest maintainability risk**: zero backend unit/integration specs (`*.spec.ts` count = 0), no frontend test runner, all behavioural verification so far lived in session-local headless harnesses that are not in the repository. The verification gate covers structure (typecheck, build, boundaries, routes, providers) but not behaviour.

---

## 13. Findings summary

### Critical
None that blocks continuing. Two items should be fixed before new modules are added because every new module would inherit them:

1. **Malformed `:id` → 500 on every non-notification route** — add `ParseUUIDPipe` (or a Prisma-error mapping in `GlobalExceptionFilter`) project-wide. Log noise and an information-free 500 today; a real availability issue once bots probe ids.
2. **Newsletter unsubscribe without proof of ownership** ([`newsletter.controller.ts:15-18`](../backend/src/newsletter/newsletter.controller.ts#L15-L18)) — signed/unguessable unsubscribe token in the welcome mail and footer link.

### Important
3. Admin Registry missing: `layouts/admin.vue` and `usePermissions` hard-code shop sections (§2.3) — the last Core→shop coupling in the repository.
4. 44 raw `$fetch` references in 21 files bypass `useApi`, including every admin page and the checkout (§3).
5. No behavioural tests in the repo; frontend typecheck (22 pre-existing errors, all in older files) and lint (10 errors, 37 warnings, pre-existing) are not CI gates; CI runs the backend job only.
6. Order creation has no idempotency key — a double submit places two orders and decrements stock twice.
7. `/health` reports only Postgres; Redis/MinIO/mail state is invisible to orchestration.
8. Settings admin form and seed hard-code pricing keys (registry exists, consumers don't use it).
9. Dead Supabase-era code and dependencies (§2.4) — small, but they contradict the docs and confuse newcomers.

### Nice-to-have
10. `useLocalized()` helper before any localisation schema change (28 ternaries).
11. Notifications: composite index `(user_id, created_at DESC)`, retention purge, focus management in the bell dialog.
12. Frontend `STAFF_ROLES` duplication → `/profile.is_staff`.
13. Pin `minio` and `mailpit` image tags; add Redis/MinIO health indicators.
14. `updateStatus` status-conditional update (consistency with `cancel()`).
15. Google button rendered when OAuth is not configured (expose provider flags via a public config endpoint or runtime config).

---

## 14. Suitability of the stack

Nuxt 4 + NestJS 11 + PostgreSQL + Redis + MinIO + Stripe remains the right shape for a single-tenant, clone-per-client starter: every provider is behind an adapter with one implementation, the module boundary is enforced mechanically, the schema split matches ownership, and the deployment is one `docker compose` file per environment. Nothing in the codebase pushes toward a different runtime, framework, or a queue/worker tier at this size. The only stack-level decision still open is the Nuxt-layers split (Phase 2), and the code has been kept ready for it (config-driven shells, `.global.vue` prefixes, per-layer i18n namespaces already separated by key prefix).
