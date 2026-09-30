# Progress Audit — 2026-09-18

Feature inventory and completion status of `shop-starter-kit` at commit `a49b4c6`. Each row was verified by reading the implementation and its consumers, not by the presence of files. Status vocabulary: **Production-ready** (complete, guarded, exercised end-to-end), **Partial** (works, with a named gap), **Scaffolded** (files exist, behaviour incomplete or unused), **Dead** (present, unused, scheduled for removal).

See [ARCHITECTURE-AUDIT.md](ARCHITECTURE-AUDIT.md) for the structural assessment and [REMAINING-ROADMAP.md](REMAINING-ROADMAP.md) for what comes next.

---

## 1. Core infrastructure

| Feature | Status | Files | Limitations |
|---|---|---|---|
| NestJS bootstrap: helmet, cookie parser, global `ValidationPipe` (whitelist/forbid/transform), `GlobalExceptionFilter`, `SnakeCaseInterceptor`, CORS allow-list, raw body for webhooks | Production-ready | `backend/src/main.ts`, `common/` | Prisma errors not mapped to HTTP codes (malformed UUID → 500) |
| Environment contract (Joi; core required, providers conditional; `isXConfigured()` helpers) | Production-ready | `core/config/env.validation.ts` | — |
| Structured logging (`nestjs-pino`, cookie/authorization redaction, pretty in dev) | Production-ready | `app.module.ts` | No request-id surfaced to clients |
| Rate limiting (throttler 100/min global; 3/min refresh + forgot-password; Nginx zones) | Production-ready | `app.module.ts`, `auth.controller.ts`, `docker/nginx/nginx.conf` | No per-account lockout on `/auth/login` |
| Prisma service + multi-file schema (`core`/`infrastructure`/`ecommerce`) | Production-ready | `prisma/`, `backend/prisma/*.prisma` | `RefreshToken` model is dead weight |
| Redis service (get/set-with-TTL/del/exists/scan-delete), fail-soft | Production-ready | `redis/` | Outage is silent beyond WARN logs; no health indicator |
| Core event bus (`CoreEventBus`, typed map, awaited emit, log-and-continue) | Production-ready | `core/events/` | One event so far (`user.authenticated`); no Event Registry yet (Phase 2) |
| Permission registry (capabilities, role presets, boot validation, `permissionsFor`) | Production-ready | `auth/permissions.registry.service.ts`, `auth/permissions.module.ts` | Frontend mirrors `STAFF_ROLES` and section→capability by hand |
| Settings registry + KV store (`Setting` table, `define()`, cached `getAll()`, admin read/write allow-listed by registered keys) | Production-ready | `settings/` | Admin form and seed hard-code the pricing keys instead of iterating the registry |
| User-extensions registry (module fields joined onto `/profile`, login/register/refresh, `/admin/customers`) | Production-ready | `users/user-extensions.registry.ts` | — |
| Health endpoint (Terminus, Postgres ping) | Partial | `health/` | Redis, MinIO, mail not reported |
| Verification gate: typecheck, build, boundary map, route-inventory snapshot, provider-boot matrix; GitHub Actions backend job | Production-ready | `backend/scripts/verify-*.js`, `.github/workflows/verify.yml` | No frontend job; no behavioural tests in either job |

## 2. Authentication and identity

| Feature | Status | Files | Limitations |
|---|---|---|---|
| Register / login (bcrypt 12, generic failure message) | Production-ready | `auth/auth.service.ts`, `users/users.service.ts` | No email verification |
| JWT access token (15 min, httpOnly cookie or Bearer) | Production-ready | `auth/strategies/jwt.strategy.ts` | — |
| Refresh tokens in Redis with `jti`, single-use rotation, revoke-all on logout/reset, throttled | Production-ready | `auth/auth.service.ts` | Redis outage = refresh refused (fail-closed) |
| Per-request user reload (role changes and deletions effective immediately) | Production-ready | `jwt.strategy.ts` | — |
| Google OAuth (login / auto-link by email / create passwordless; optional provider) | Production-ready | `auth/strategies/google.strategy.ts`, `auth/guards/google-auth.guard.ts`, `app/pages/auth/callback.vue` | Login page shows the Google button even when OAuth is not configured |
| Forgot / reset password (Redis token, 1 h, one-time, mail, sessions revoked) | Production-ready | `auth/auth.service.ts`, `app/pages/forgot-password.vue`, `reset-password.vue` | Depends on a configured mail transport (503-style warning otherwise) |
| Profile read/update (`/profile`, name + phone) with `permissions[]` | Production-ready | `profile/` | No change-password or change-email while logged in; no account deletion |
| Frontend session: `useApi` refresh dance, `auth` store, `auth`/`guest`/`admin` middleware, server-side profile fetch | Production-ready | `app/composables/useApi.ts`, `app/stores/auth.ts`, `app/middleware/*`, `app/plugins/auth*.ts` | Session-dependent header elements hydrate with a known warning |
| Capability guards (`RequirePermissions`, owner bypass, untagged Core = owner-only) | Production-ready | `auth/guards/permissions.guard.ts`, `auth/decorators/permissions.decorator.ts` | — |

## 3. Admin (Core)

| Feature | Status | Files | Limitations |
|---|---|---|---|
| Admin shell (layout, section nav, per-capability visibility, landing-path resolution, `.ac-*` primitives, date-range control) | Partial | `app/layouts/admin.vue`, `app/assets/css/admin.css`, `app/middleware/admin.ts`, `usePermissions.ts` | Shop sections hard-coded in the Core layout — Admin Registry (Phase 2) not built |
| Staff management (list, create with role, change role, reset password, demote; self-change and last-owner guards) | Production-ready | `staff/`, `app/pages/admin/staff/index.vue` | Raw `$fetch` (5) |
| Customers list (paginated, search, `_count.orders` + loyalty via extensions) | Production-ready | `users/users-admin.controller.ts`, `app/pages/admin/customers/index.vue` | Read-only; no customer detail page |
| Newsletter admin (list, CSV export) | Production-ready | `newsletter/newsletter-admin.controller.ts`, `app/pages/admin/newsletter/index.vue` | — |
| Settings admin (read/write registered keys) | Partial | `settings/settings-admin.controller.ts`, `app/pages/admin/settings/index.vue` | Form hard-codes the five pricing keys |
| Staff notifications inbox (stock alerts; list/unread/mark-read/mark-all; bell in admin shell; `view:notifications`) | Production-ready | `notifications/notifications.controller.ts`, `app/pages/admin/notifications/index.vue`, `useAdminNotifications.ts` | Compares `type === 'OUT_OF_STOCK'` while the wire lowercases `type` — icon/label branch never matches (visual only) |
| Image upload endpoint (5 MB, magic-byte + mime whitelist, `manage:media`) | Production-ready | `uploads/` | No resizing; no quota |

## 4. Shop — catalogue

| Feature | Status | Files | Limitations |
|---|---|---|---|
| Public catalogue: list (12/page, search EL/EN, category, brand[], price range, in-stock, sort), detail by slug, related, brands | Production-ready | `products/products.controller.ts`, `products.service.ts`, `dto/query-products.dto.ts`, `app/pages/products/*`, `brands.vue`, `ProductFilters.vue`, `useProducts.ts` | Column-per-locale content (28 client ternaries); no variants |
| Admin catalogue: create/update/deactivate, cost & compare-at price, per-product image sub-resource (add, reorder/set-primary, remove with orphan pruning) | Production-ready | `products/products-admin.controller.ts`, `ProductDrawer.vue`, `app/pages/admin/products/index.vue` | `admin/products/[id].vue` is an empty stub; raw `$fetch` |
| Categories: public tree, admin CRUD, cache invalidation through the products owner | Production-ready | `categories/`, `app/pages/admin/categories/index.vue` | — |
| Stock alerts (low/out-of-stock open/refresh/resolve, escalation) | Production-ready | `products/stock-alerts.service.ts` | Threshold fixed at 10 (not a setting) |
| Storage adapter + MinIO (put/resolve/presign/remove; external URLs pass through) | Production-ready | `storage/` | — |
| Favourites (toggle, list, ids; per user) | Production-ready | `favourites/`, `app/stores/favourites.ts`, `app/pages/account/favourites.vue` | — |

## 5. Shop — orders, payments, loyalty

| Feature | Status | Files | Limitations |
|---|---|---|---|
| Cart (persisted Pinia store, drawer, header button) | Production-ready | `app/stores/cart.ts`, `components/cart/*`, `useCartDrawer.ts` | Client-only; prices re-validated server-side at order creation |
| Checkout: shipping/pickup, Stripe / cash-on-pickup / card-on-pickup, guest checkout with email, loyalty redemption, stock decrement, pricing from settings | Production-ready | `orders/orders.service.ts#create`, `orders/dto/create-order.dto.ts`, `app/pages/checkout/*` | No idempotency key on `POST /orders` (double submit = two orders); no VAT, no shipping providers |
| Stripe checkout session + hosted redirect, session verification, success/cancel pages | Production-ready | `payments/`, `payments-provider/stripe.provider.ts`, `app/pages/checkout/{success,cancel}.vue` | Single provider |
| Webhook settlement with `ProcessedEvent` ledger (completed → CONFIRMED+PAID+loyalty; expired → cancel) | Production-ready | `payments/payments.service.ts`, `infrastructure.prisma#ProcessedEvent` | Cancelled-then-paid orders need a manual refund (logged) |
| Order lifecycle: transition table, admin status change with `allowed_statuses`, cancel with restock + loyalty reversal (transactional, race-safe) | Production-ready | `orders/order-status.ts`, `orders.service.ts`, `orders-admin.controller.ts`, `app/pages/admin/orders/index.vue` | `updateStatus` not status-conditional (last write wins); no refunds |
| Customer orders: list with `can_cancel`, detail with lifecycle progress, self-cancel of pending unpaid orders, repeat order | Production-ready | `orders/orders.controller.ts`, `app/pages/account/orders/*`, `useOrderPresentation.ts` | — |
| Order confirmation email (branded template, sent on settlement) | Production-ready | `orders/order-confirmation.mail.ts`, `mail/mail.service.ts` | No status-change emails (in-app notifications instead, by decision) |
| Guest-order linking on authentication (event subscriber, awards loyalty for paid orders) | Production-ready | `orders/guest-order-linker.service.ts` | — |
| Loyalty: `LoyaltyAccount` + ledger, earn/redeem rates and minimum from settings, reversal on cancel, `/profile/loyalty` history, account page/card/badge | Production-ready | `loyalty/`, `app/pages/account/loyalty.vue`, `components/loyalty/*` | — |
| Analytics: overview (range, granularity, compare-to-previous), dashboard stats, 5-min cache, `view:finance` | Production-ready | `analytics/`, `app/pages/admin/{index,analytics}` | Aggregates all orders per query; fine at current scale |

## 6. Notifications

| Feature | Status | Files | Limitations |
|---|---|---|---|
| Per-user notifications schema (`user_id`, unique `key`, `meta`, `ORDER_STATUS`) | Production-ready | `core.prisma#Notification`, migration `20260918100000` | No composite `(user_id, created_at)` index; no retention |
| Core primitives: idempotent `create`, tx-joinable `createWrite`, scoped inboxes, per-user unread cache | Production-ready | `notifications/notifications.service.ts` | — |
| Customer routes (`GET /notifications`, unread-count, mark one, mark all; UUID + page normalisation) | Production-ready | `notifications/customer-notifications.controller.ts` | Page size fixed at 20 |
| Order status producer (every transition into CONFIRMED/PROCESSING/READY/COMPLETED/CANCELLED, inside the status transaction, guest orders skipped) | Production-ready | `orders/order-notifications.service.ts`, wired in `orders.service.ts` and `payments.service.ts` | — |
| Bell + panel (badge, dialog a11y, mark one/all, order links, loading/empty/error/retry, session-race guard) | Production-ready | `components/notifications/NotificationBell.global.vue`, `useCustomerNotifications.ts` | No focus trap |
| History page `/account/notifications` (URL-paged, prev/next, out-of-range redirect, sidebar entry) | Production-ready | `app/pages/account/notifications.vue` | — |

## 7. Marketing, content, SEO

| Feature | Status | Files | Limitations |
|---|---|---|---|
| Newsletter subscribe (footer), welcome email once, unsubscribe page | Partial | `newsletter/`, `AppFooter.vue`, `app/pages/unsubscribe.vue` | Unsubscribe is by plain email with no token; no double opt-in |
| Transactional mail (SMTP/Resend, branded layout, reset / welcome / order templates; disabled-safe) | Production-ready | `mail/mail.service.ts` | Brand values from `BRAND_*` env, duplicated from `brand.css` by design |
| Home, About, Contact, Brands pages; WhatsApp button; opening hours; LocalBusiness JSON-LD; OG/SEO meta | Production-ready | `app/pages/{index,about,contact,brands}.vue`, `useBusinessSchema.ts`, `useOpeningHours.ts`, `app.vue` | Business identity in `app/utils/business.ts` (project config file pending, Phase 3) |
| i18n EL/EN, prefix-except-default, 496 keys each | Production-ready | `i18n/*.json`, `nuxt.config.ts` | Locale list hard-coded in `nuxt.config.ts` |
| Branding (`brand.css`, `BrandLockup/Wordmark`, colour-mode plugin forced light) | Production-ready | `app/assets/css/brand.css`, `components/Brand*` | — |

## 8. Deployment and operations

| Feature | Status | Files | Limitations |
|---|---|---|---|
| Docker Compose dev (Postgres 16, Redis 7 auth, MinIO, Mailpit, backend, Nuxt; Nginx behind profile) | Production-ready | `docker-compose.yml`, `docker-compose.override.yml` | `minio`/`mailpit` tags unpinned |
| Docker Compose prod + Nginx TLS, headers, rate zones, media proxy | Production-ready | `docker-compose.prod.yml`, `docker/nginx/nginx.conf` | Certs mounted manually; no renewal/backup automation (deferred) |
| Backend image (multi-stage), `start.sh` migrate → seed → run; owner bootstrap via env; demo data opt-in | Production-ready | `backend/Dockerfile`, `backend/start.sh`, `prisma/seed.ts` | — |
| Nuxt image | Production-ready | `Dockerfile.nuxt` | — |
| Downstream reconciliation manual (PetShopCY) | Production-ready | `PETSHOPCY-MANUAL.md` | Not yet generalised into a new-project cloning guide |

## 9. Documentation

| Item | Status |
|---|---|
| `AGENTS.md`, `docs/ARCHITECTURE-BLUEPRINT.md`, `ARCHITECTURE-DECISIONS.md` (D1–D13, E-series), `DEPENDENCY-RULES.md`, `MODULE-DEVELOPMENT-GUIDE.md`, `ARCHITECTURE-CHECKLIST.md` | Current — seam table matches the code; last updated with each seam |
| Feature docs (order lifecycle §3.10a/b, product images, provider adapters, cache owners, loyalty, Seam 9 shells) | Current |
| Notifications system (schema, producer, bell, history page) | **Not documented** in the guide/blueprint — the four commits `c935d60`…`a49b4c6` and the fixes in `16dcb5b` have no docs entry |

## 10. Dead or scaffolded

| Item | Status | Action |
|---|---|---|
| `app/types/database.types.ts` (Supabase types), `app/pages/confirm.vue`, `app/pages/admin/products/[id].vue`, `plugins/stripe.client.ts` `$stripe`, `nuxt.config.ts` private `runtimeConfig` secrets, root `stripe`/`resend`/`zod` deps, `app/package.json` | Dead | Delete with approval (blueprint Phase 1 list) |
| `RefreshToken` model + `User.refreshTokens` | Dead | Drop in the next Core migration |
| Unit/integration tests | Absent (0 `*.spec.ts`, no frontend runner) | Phase 4 |

---

## 11. Completion by area

| Area | Status | Completion | Notes |
|---|---|---|---|
| Core infrastructure (bootstrap, env, logging, Redis, events, registries, verification gate) | Complete for v1 | 90 % | Missing: Redis/MinIO health, Prisma error mapping, Event/Admin registries (Phase 2), dead-code removal |
| Authentication & authorization | Complete for v1 | 90 % | Missing: email verification, lockout, change-password-in-session, conditional Google button (all listed as non-architectural deferrals) |
| Admin functionality | Mostly complete | 75 % | All sections work; shell is not registry-driven; settings form hard-coded; raw `$fetch` everywhere; no customer detail page |
| Shop functionality (catalogue, cart, checkout, payments, orders, loyalty, favourites, analytics) | Complete for v1 | 85 % | Missing: order idempotency key, refunds, VAT, variants, shipping providers (deferred), status-conditional `updateStatus`, `useLocalized()` |
| Notifications | Complete | 95 % | Missing: docs entry, composite index, retention, focus trap |
| Marketing / content / SEO | Mostly complete | 80 % | Newsletter unsubscribe token + double opt-in; project config file |
| Database | Complete for v1 | 90 % | Dead `RefreshToken`; localisation strategy still column-per-locale |
| Deployment / infrastructure | Complete for single-host v1 | 80 % | Unpinned images, no backups/renewal automation, health coverage |
| Quality gates & tests | Structural only | 35 % | Backend structural gate + CI exist; zero behavioural tests; frontend typecheck/lint not gated |
| Architecture programme (blueprint phases) | Phase 1 done | Phase 0 ✓ · Phase 1 ✓ (dead-code list open) · Phase 2 ~25 % (registries: permissions/settings/user-extensions done; admin/event/module registries and Nuxt layers open) · Phase 3 0 % · Phase 4 ~20 % (backend gate + CI) | See roadmap |

---

## 12. Progress summary

**Completed**
- Core: bootstrap, env contract, logging, Redis, event bus, permission/settings/user-extension registries, verification gate + CI (backend).
- Auth: local + Google, JWT/refresh rotation in Redis, password reset, capability guards, staff management.
- Admin: shell with capability-gated sections, staff, customers, newsletter, settings, stock-alert inbox, uploads.
- Shop: catalogue + filters, admin catalogue with image management, categories, favourites, cart, checkout (Stripe + on-pickup, guest), webhook settlement with idempotency ledger, order lifecycle with cancellation/restock/loyalty reversal, customer order pages with self-cancel, loyalty, analytics.
- Notifications: per-user schema, order-status producer, bell, history page, hardening fixes.
- Blueprint Phase 1: all ten seams cut; boundary baseline empty.

**In progress**
- Phase 2 registries: three of six exist (permissions, settings, user extensions); Admin, Event and Module registries not started; frontend consumers of the settings registry not started.
- Dead-code removal (Phase 1 residue): identified, not executed.

**Planned, not started**
- Backend folder layers and Nuxt layers (Phase 2); `project.config.ts` (Phase 3); tests, frontend CI gates, new-project cloning guide (Phase 4); notifications documentation.

**Technical debt / cleanup**
- 44 raw `$fetch` references; hard-coded admin nav/caps; hard-coded settings form; 28 locale ternaries; malformed-UUID 500s; newsletter unsubscribe token; order idempotency; Supabase leftovers; `RefreshToken`; unpinned images; health coverage.
