# Remaining Roadmap — 2026-09-18

What is left before `shop-starter-kit` can be called complete as a reusable v1 starter, derived from the repository at `a49b4c6` (see [ARCHITECTURE-AUDIT.md](ARCHITECTURE-AUDIT.md) and [PROGRESS-AUDIT.md](PROGRESS-AUDIT.md)). Items reference the blueprint phase they belong to where one exists. Sizes are relative: **S** ≤ half a day, **M** one to two days, **L** several days.

---

## A. Critical — correctness, security, production readiness

| # | Item | Why | Where | Size |
|---|---|---|---|---|
| A1 | **Map malformed ids and Prisma not-found to 400/404 project-wide** — `ParseUUIDPipe` on every `:id`/`:ref` param, or a Prisma-error branch in `GlobalExceptionFilter` (`P2023` → 400, `P2025` → 404) | Every non-notification route answers 500 with a stack trace in the logs for `/orders/abc`; probing bots fill the error log; the filter fix covers future modules automatically | `backend/src/common/filters/http-exception.filter.ts`, `orders/orders.controller.ts`, `products/products-admin.controller.ts`, `categories/*`, `staff/*`, `favourites/*` | S |
| A2 | **Newsletter unsubscribe with a signed token** — HMAC(email) or a stored token in the welcome mail and the footer/unsubscribe page; keep the old query form for one release only if a live client depends on it | `DELETE /newsletter/unsubscribe?email=` lets anyone remove any address | `newsletter/newsletter.service.ts`, `newsletter.controller.ts`, `mail/mail.service.ts#sendWelcomeEmail`, `app/pages/unsubscribe.vue` | S |
| A3 | **Idempotent order creation** — accept an `Idempotency-Key` header (or a client-generated `orderRef`) on `POST /orders`, stored on the order with a unique index; a repeat returns the existing order | Double submit / retry after a timeout creates two orders and decrements stock twice; the checkout page has no protection beyond a disabled button | `orders/orders.service.ts#create`, `orders/dto/create-order.dto.ts`, `ecommerce.prisma#Order`, `app/pages/checkout/index.vue` | M (one additive migration) |
| A4 | **Health coverage** — add Redis (`PING`) and, when configured, MinIO (`bucketExists`) indicators to `/health`; keep Postgres | Orchestration and the Nginx `/health` passthrough cannot see a Redis outage, which presents as "everyone gets logged out" | `health/health.controller.ts`, `redis/redis.service.ts`, `storage/storage-adapter.ts` | S |
| A5 | **Frontend gates in CI** — `pnpm build`, `eslint app types`, `vue-tsc` (fix the 22 pre-existing type errors and 10 lint errors first, then gate) | Nothing stops a broken frontend from merging; the backend gate has caught two regressions this month, the frontend has none | `.github/workflows/verify.yml`, `package.json` (add `typecheck`, pin `vue-tsc` and `eslint` as devDependencies) | M |
| A6 | **Behavioural tests in the repository** — port the session harnesses that already exist for auth refresh, permissions, order lifecycle, webhook idempotency and notifications into Jest (backend, against a scratch database) and a minimal Vitest/Playwright setup (frontend) | All behaviour verification so far lives outside the repo; a future contributor has no safety net | `backend/test/`, `backend/package.json`, root `vitest`/`playwright` config | L |

A1–A4 are small and should land **before any new module**, because each new module would otherwise inherit the same defect (A1, A4) or the same missing pattern (A3). A5–A6 are the Phase 4 gates pulled forward: they are large but they de-risk everything that follows.

---

## B. Important — complete and polished product, not blocking the architecture

| # | Item | Why | Where | Size |
|---|---|---|---|---|
| B1 | **Admin Registry (Phase 2)** — `adminSections[]` in `app.config` (`id, path, capability, titleKey, icon, order, group`); `layouts/admin.vue`, `middleware/admin.ts` and `usePermissions.requiredCapFor/firstAllowedPath` read it; shop entries move to the shop's config | Last Core→shop coupling in the repo; every new module today needs a Core edit to appear in the admin | `app/types/contributions.ts`, `app/app.config.ts`, `app/layouts/admin.vue`, `app/composables/usePermissions.ts`, `app/middleware/admin.ts` | M |
| B2 | **Registry-driven settings form and seed** — `/admin/settings` renders from `GET /admin/settings` definitions (type, label key, default); `seed.ts` iterates `SettingsService.definitions()` | Seam 4 residue; adding a module setting today means editing a Core page and the seed | `app/pages/admin/settings/index.vue`, `settings/settings-admin.controller.ts` (expose definitions), `backend/prisma/seed.ts` | M |
| B3 | **Migrate raw `$fetch` to `useApi`** — 44 references in 21 files; add `// raw-fetch:` comments only where SSR-time public reads justify it | Rule in AGENTS.md; admin pages and checkout currently skip refresh-and-retry | all files listed in the architecture audit §3 | M |
| B4 | **Dead-code removal (Phase 1 residue)** — Supabase types, `confirm.vue`, `admin/products/[id].vue`, `$stripe` plugin, frontend `runtimeConfig` secrets, root `stripe`/`resend`/`zod`, `app/package.json`, `RefreshToken` model (+ migration) | Contradicts the docs, confuses newcomers, keeps secrets in the wrong config | listed in ARCHITECTURE-AUDIT §2.4 | S (needs explicit approval per item) |
| B5 | **Notifications documentation** — MODULE-DEVELOPMENT-GUIDE §3.10c (producer pattern, key format, tx-joined write), blueprint seam 5 residue closed, D-record for in-app-only notifications | Four feature commits and one fix commit are undocumented | `docs/MODULE-DEVELOPMENT-GUIDE.md`, `docs/ARCHITECTURE-BLUEPRINT.md`, `docs/ARCHITECTURE-DECISIONS.md` | S |
| B6 | **Staff inbox type comparison** — `n.type === 'OUT_OF_STOCK'` never matches the lowercased wire value; out-of-stock alerts render as low-stock | Visible bug in the admin inbox | `app/pages/admin/notifications/index.vue:39-45,94,129` | S |
| B7 | **`useLocalized()` helper** — one composable resolving `name_el/name_en` (etc.) by locale; replace the 28 ternaries | Prerequisite the blueprint names before any localisation schema change (D5) | `app/composables/useLocalized.ts` + consumers | S |
| B8 | **Conditional provider UI** — expose `providers: { google, payments, storage }` (public, from `isXConfigured()`) and hide the Google button / online-payment option when off | Frontend advertises features the backend answers 503 to | `health` or a new `GET /config` in Core, `app/pages/login.vue`, `app/pages/checkout/index.vue` | S |
| B9 | **Status-conditional `updateStatus`** — `updateMany({ where: { id, status: current } })` like `cancel()`, 409 on race | Two staff moving the same order concurrently: last write wins silently | `orders/orders.service.ts#updateStatus` | S |
| B10 | **Account self-service** — change password and email while logged in, delete account (orders `SetNull`, notifications cascade already correct) | Expected in any customer account section; only reset-by-mail exists | `profile/`, `app/pages/account/index.vue` | M |
| B11 | **Pin infrastructure images; document backups/TLS renewal** — `minio/minio:RELEASE.x`, `axllent/mailpit:vX`; a `docs/OPERATIONS.md` with the pg_dump/MinIO mirror and certbot procedure | `latest` tags make rebuilds non-reproducible; ops steps exist only in people's heads | `docker-compose*.yml`, `docs/` | S |
| B12 | **Login lockout / progressive delay** — per-account counter in Redis on `/auth/login` | Only IP-level limits today (100/min Nest, 10/min Nginx) — a distributed guess is cheap | `auth/auth.service.ts#login` | S |
| B13 | **Notifications index + retention** — composite `(user_id, created_at DESC)`; a purge of read rows older than N days (needs a scheduler: `@nestjs/schedule` is the smallest fit and would be the first cron in the backend) | Rows grow ~5 per order per customer forever | `core.prisma`, one migration, `notifications/` | S–M |

---

## B2. Extraction sequence (from [EXTRACTION-READINESS.md](EXTRACTION-READINESS.md), 2026-09-18)

Order chosen so every step is a pure move (revertible, no behaviour, no migration) and the gates stay green.

| Step | Slice | Pre-requisite / blocker | Gate |
|---|---|---|---|
| ~~E1~~ | ~~**F1**~~ **done 2026-09-18** — provider-local presence rules (`isStorageConfigured`/`isPaymentsConfigured`/`isMailConfigured` next to their providers; no file move); INFRA→CORE added to rule A | — | boundaries 0, providers scenarios unchanged, audit forbidden 0 |
| ~~E2~~ | ~~**Backend Infrastructure package**~~ **done 2026-09-20** — `backend/src/infrastructure/{prisma,redis,storage,payments-provider,mail,health,common}`; 20 renames (R100), 46 import rewrites, scripts/tests re-pointed; `common/` under `infrastructure/`, `env.validation.ts` stays in `core/config`, `payments-provider` kept singular | — | verify green, routes 65/65 byte-identical, audit edge set identical |
| ~~E3a~~ | ~~**Backend folder layers**~~ **done 2026-09-22** — `src/core/{auth,users,profile,staff,settings,notifications,newsletter,uploads}` (+ existing `config`, `events`), `src/modules/ecommerce/{products,categories,favourites,orders,payments,loyalty,analytics}` (flat, no `catalog/`; `uploads` stays Core); 90 renames R100, 100 import rewrites; scripts: layers by top folder, units `core/<x>`/`modules/ecommerce/<x>` for cycles + rule E | ~~E2~~ | verify green, routes 65/65 byte-identical, audit edge set identical |
| ~~E3b~~ | ~~**Shop root module**~~ **done 2026-09-22** — `EcommerceModule` (imports 7 sub-modules, exports nothing, provides `EcommercePermissions`); `SHOP_ROLE_PRESETS` moved to `ecommerce-permissions.ts`; `OrdersPermissions` capabilities only; `AppModule` imports `EcommerceModule` (F10 closed). Residual follow-up: `core/staff/dto/staff.dto.ts` literal role list | ~~E3a~~ | verify green, 17 unit tests incl. pinned registry outputs, pre/post permissions + admin matrix identical, routes 65/65 byte-identical |
| E4 | **F2** `UsersService.exists()/countCustomers()` (optional) | — | harnesses |
| E5 | **Frontend Shop layer** `app/modules/ecommerce` (+ `Shop*` prefixes, Shop half of `types`/`i18n`, its `app.config` entries) | — | `pnpm lint/typecheck/test/build`, UI harnesses EL/EN |
| ~~E6a~~ | ~~**P1** brand contribution~~ **done 2026-09-22** — `app/project/` Nuxt layer (`#project`), `Project*` brand components, `app.config.brand` + `globalWidgets` contribution, `project` config block for SEO/footer values; Core→Project 12 → 1 (`app.vue` → `useBusinessSchema()`) | ~~Q1~~ (decided: contribution) | gates green, audit forbidden 1, UI suites pass |
| ~~E6b~~ | ~~**F5** footer link contributions~~ **done 2026-09-22** — `FooterColumnContribution`/`FooterItemContribution` + `app/utils/footer-registry.ts` (7 unit tests); Core, shop and project layers contribute their own columns/items; `app.config.project.footer` names the project's copy keys; `ShopHeaderSearch` owns `products.search_placeholder`. Core→Project remains **1** (deferred) | ~~E6a~~ | gates green, audit unchanged, six UI suites pass |
| E6c | **The last Core→Project edge**: `app.vue` → `useBusinessSchema()` — a project plugin (layer convention) or `app.vue` joining the project layer with E7 | E6b | audit frontend forbidden → 0 |
| E7 | **Frontend Core layer** `app/core` + project layer (`app.config.ts`, brand, `business.ts`, home/about/contact) | E5, E6 | `--strict` audit passes |
| E8 | **Module Registry** (C2): `app.module.ts`/`nuxt.config.ts` and both scripts read one registry (F11) | E3b, E7 | — |
| later | **S1** `NotificationType` enum → string; **S2** schema generation per enabled module; Event Registry code | a second module | — |

**Blockers today**: ~~F1~~ (closed), P1 (frontend Core brand residue, medium), F5 (footer/search, small), F7 (mechanical split), S1/S2 (schema, only for a second module or optional-module builds). Intentional exceptions kept: guard contract (`users→auth/guards`), `payments` writing `order` inside the ledger transaction (F3), `app.config` referencing components by name, Prisma back-relations on `User`.

---

## C. Optional / future enhancements

| # | Item | Notes |
|---|---|---|
| C1 | Backend folder layers (`core/`, `modules/ecommerce/`, `infrastructure/`) and Nuxt layers (`app/core`, `app/modules/ecommerce`) with component prefixes | Phase 2 layout move; mechanical once B1–B3 are done; changes no contract; do it in one approved commit with the boundary script's layer map updated in the same change |
| C2 | Module Registry / enabled-modules composition (`app.module.ts`, `nuxt.config.ts`) and Event Registry (typed names) | Phase 2; only valuable once a second module exists |
| C3 | `project.config.ts` (name, locales, currency, branding, enabled modules) replacing `app/utils/business.ts` + `BRAND_*` env + `brand.css` values; `app/project` layer; project seed split from the Core image | Phase 3 |
| C4 | Email verification on register; 2FA for staff | Blueprint §14.2 deferrals |
| C5 | Refunds (Stripe refund via the provider interface + `REFUNDED` payment status flow), VAT lines, product variants, shipping providers/rates | Shop features explicitly out of v1 |
| C6 | Image variants/resizing at upload (sharp), upload quotas | Media sub-domain |
| C7 | Customer detail page in admin (orders, loyalty ledger, notifications) | Admin polish |
| C8 | ~~Notification presenter registry (per-module `describe()`)~~ done (`app/utils/notification-presenters.ts`, shop plugin); bell focus trap, real-time push (SSE) for the badge | Only when a second notification type appears |
| C9 | Order status emails as an opt-in channel next to in-app | Decided against for v1; would reuse `MailService` + the producer |
| C10 | New-project cloning guide and script (`scripts/new-project`), generalised from `PETSHOPCY-MANUAL.md` | Phase 4; the reason the starter exists |
| C11 | Second small module built against the guide (contact form or blog stub) | Phase 4 validation of the module contract |
| C12 | Request-id propagation (`x-request-id` from Nginx → pino → error payload) | Observability |

---

## D. Recommended development order and dependencies

```text
1. A1 A2 A4 B6 B9 ─┐  small correctness fixes, no dependencies, one commit each
2. A3 ─────────────┤  additive Order migration; do before any checkout UI work
3. B4 ─────────────┤  dead-code removal incl. RefreshToken migration (schema step; pair with A3's migration window)
4. A5 ─────────────┘  frontend gates: fix pre-existing type/lint errors, then gate CI
        │
5. B3 (raw $fetch → useApi)  ── mechanical; wanted before B1 so the admin pages are touched once
        │
6. B1 Admin Registry ── B2 Settings form/seed ── B8 provider flags ── B7 useLocalized
        │   (all frontend/registry work; each independent of the others, all before C1)
        │
7. B5 docs + B11 ops docs (can run in parallel with anything)
        │
8. A6 tests ── land alongside 6, in the same PRs where possible; must exist before C1
        │
9. C1 folder + Nuxt layers ── only after B1–B3 (nothing shop-specific left in shells) and A6 (tests catch the move)
        │
10. C2 Module/Event registries → C3 project.config → C10/C11 cloning guide + second module
        │
11. B10 B12 B13 C4–C9 ── independent product features; schedule by client demand
```

Reasoning:

- **Fixes before features.** A1/A4 are inherited by every future module; A3 changes the `Order` schema and should ship before more checkout work touches the same code.
- **Schema changes together.** A3 (order idempotency column) and B4 (`RefreshToken` drop) are both additive/destructive migrations on a live-client history; batching them keeps the downstream reconciliation (`PETSHOPCY-MANUAL.md`) to one migration window.
- **Frontend gates before frontend refactors.** B1–B3 rewrite most admin pages; doing that without typecheck/lint in CI (A5) repeats the situation that produced the 32 pre-existing errors.
- **Registries before layers.** The Phase 2 layer move is mechanical only once nothing in the Core shells names a shop path or capability (B1) and the settings form reads the registry (B2). Moving folders first would move the coupling with them.
- **Tests before the move.** The layer split touches every import path; A6 is what makes it safe.
- **Project config last.** C3 depends on the layers existing (a project layer needs somewhere to live) and on the registries being the only way modules surface in the UI.
- **Independent tracks.** B5/B11 (docs), B10/B12 (auth polish), B13 (notifications), C5–C9 (shop features) have no architectural dependency and can be interleaved as client work requires.

---

## E. Next milestone

**"Hardening + gates"** — A1, A2, A3, A4, B6, B9, B4 and A5, in that order, each as its own reviewed commit. Roughly one week of focused work. It ends with: no 500 on malformed input anywhere, no unauthenticated unsubscribe, idempotent checkout, a health endpoint that tells the truth, no Supabase residue, and a CI that gates both halves of the repository. After that milestone the codebase is ready for the Phase 2 registry work (B1–B3) and, behind it, the layer split.
