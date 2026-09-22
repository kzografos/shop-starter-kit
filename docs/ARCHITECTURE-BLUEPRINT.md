# Architecture Blueprint v1

**Status:** Adopted · **Date:** 2026-09-14 · **Applies to:** `shop-starter-kit` and every project derived from it
**Companion documents:** [ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md) (D1–D12), [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md) (enforceable rules), [MODULE-DEVELOPMENT-GUIDE.md](MODULE-DEVELOPMENT-GUIDE.md) (how to build a module), [ARCHITECTURE-CHECKLIST.md](ARCHITECTURE-CHECKLIST.md) (per-task checklist), [`AGENTS.md`](../AGENTS.md) (AI-agent instructions)
**Basis:** three read-only audits (repository discovery, dependency & coupling, readiness check). Every seam named here was located in code before being written down.

This document is the canonical description of the target architecture. Where it conflicts with README, older audit notes, or `.claude/` files, this document wins.

---

## 1. Architecture Goal

> A reusable, single-tenant, full-stack starter system for independently deployed client websites, e-commerce applications, and future web applications.

The Starter System is a **starting point, not a shared runtime dependency**. A client project is created by cloning it, enabling the modules the client needs, and adding client-specific code in the Project layer. After that the project lives on its own.

Every client project has:

| Its own… | Meaning |
|---|---|
| Repository | Cloned from the starter; upstream changes arrive by cherry-pick or manual reconciliation, never by a shared package version bump |
| Database | One PostgreSQL database; no `tenantId`, no shared tables |
| Environment variables | One `.env` per host; no central secret store |
| Deployment | One Docker Compose stack behind one Nginx |
| Enabled modules | Declared in project configuration; disabled modules contribute nothing at boot |
| Branding and business rules | Project layer only; never edited inside Core or a Module |

Consequences the blueprint accepts: no multi-tenancy, no plugin marketplace, no runtime module loading. See §14 for the full deferral list.

---

## 2. Architecture Layers

```text
PROJECT
   ↓  (configures, brands, extends)
OPTIONAL MODULES
   ↓  (use)
CORE
   ↓  (uses through adapters)
INFRASTRUCTURE
   ↓
External providers (Postgres, Redis, S3-compatible storage, mail API, payment API)
```

Dependencies point **downward only**. A layer never imports from a layer above it. Layers at the same level (Module ↔ Module) communicate only through public contracts and events (§5, [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md)).

### 2.1 Core

Generic functionality that almost every project uses. Core is what boots when no module is enabled.

| Area | What it owns today (file references are the current locations, not target ones) |
|---|---|
| Authentication | Cookie JWT + Redis-backed refresh rotation, Google OAuth, password reset — `backend/src/core/auth/`, `app/plugins/auth.*`, `app/middleware/*`, auth pages |
| Users | Identity, profile, staff management — `backend/src/core/users/`, `core/profile/`, `core/staff/` |
| Generic roles & capabilities | `PermissionsGuard`, `RequirePermissions`, `permissionsFor()` mechanism — `backend/src/core/auth/guards`, `core/auth/decorators`; frontend `usePermissions` mechanism |
| Settings mechanism | Key/value table, cached read, invalidate-on-write — `backend/src/core/settings/` |
| Notifications mechanism | Inbox, unread count, mark-read — `backend/src/core/notifications/` (generic parts) |
| Newsletter / subscribers | `backend/src/core/newsletter/`, `app/pages/unsubscribe.vue` |
| Database foundation | `PrismaService`; the core schema file |
| Configuration | Env validation (Joi) with per-module fragments; the loader for project config |
| Validation | Global `ValidationPipe`, DTO conventions |
| Error handling | `GlobalExceptionFilter` |
| Logging | `nestjs-pino` with redaction |
| Generic events | In-process event bus — `backend/src/core/events/` (`CoreEventBus`, typed `CoreEventMap`); first event `user.authenticated` |
| API foundation | CORS, helmet, cookie-parser, throttler, snake_case response interceptor; frontend `useApi` |
| Admin shell | `app/layouts/admin.vue`, `admin.css`, generic admin pages (staff, customers/users, newsletter, notifications, settings) |
| Health | `backend/src/infrastructure/health/` (E2) |

**Core MUST NOT depend on:** e-commerce, products, orders, cart, wishlist/favourites, loyalty, shipping, inventory, Stripe-specific business logic, MinIO-specific business logic, client-specific branding values.

Core may *know* that modules exist only through the registries in §7. It never names a module.

### 2.2 Optional Modules

Domain and business functionality that a given project may or may not need. A module is self-contained: its own backend folder, its own Nuxt layer, its own Prisma schema file, its own i18n files, its own env fragment, its own registry contributions.

Initial planned domains:

| Module | Status |
|---|---|
| E-commerce | Exists; needs extraction (§11) |
| Payments | Exists inside e-commerce; becomes a provider-facing module |
| Storage / media | `uploads` (Core, `manage:media`) over the `StorageAdapter` (seam 7); becomes the `media` sub-domain with the Phase 2 folder move |
| Email integrations / templates | Transport exists in Core-adjacent `mail`; templates move to owning modules |
| CMS | Planned |
| Blog | Planned |
| Booking | Planned |

E-commerce conceptual subdomains:

```text
ecommerce/
├── catalog      products, categories, favourites, brands
├── orders       order creation, guest checkout, order history, pricing settings, stock alerts
├── payments     checkout sessions, webhooks, idempotency ledger use
├── loyalty      points account, earn/redeem, transaction history
├── analytics    revenue / units / margin reporting
└── media        product image upload and resolution
```

In v1 these **remain under one `ecommerce` module** with internal sub-folders. They become separately enabled modules only when a project needs one without the others (e.g. catalog without checkout). Two are flagged now as likely candidates for promotion: `media` (CMS and blog will need it) and `payments` (booking will need it). The internal folder boundaries should be respected from day one so promotion is a move, not a rewrite.

### 2.3 Infrastructure

Technical adapters to external providers. Infrastructure has **no domain knowledge**.

| Adapter | Today | Target |
|---|---|---|
| PostgreSQL / Prisma | `PrismaService` | unchanged |
| Redis | `RedisService` (`set` with mandatory TTL, `get`, `del`, `exists`, `delPattern`); owners expose `invalidate()` — **done** (seam 8) | unchanged |
| Object storage | `StorageAdapter` (`put`, `resolve`, `presign`) with `MinioStorageAdapter` in `backend/src/infrastructure/storage/` — **done** (seam 7; folder moved in E2) | unchanged |
| Email provider | `MailService` (Resend or SMTP transport + branded layout) | `MailTransport` interface; layout stays; templates leave |
| Payment providers | `PaymentProvider` (`createCheckout`, `getCheckoutStatus`, `parseWebhook`) with `StripePaymentProvider` in `backend/src/infrastructure/payments-provider/` — **done** (seam 6; folder moved in E2, name kept singular) | unchanged |
| HTTP adapters | Nest bootstrap (`main.ts`), interceptor, filter | unchanged |
| Queues | none | none in v1 (deferred) |
| Docker / Nginx / deployment | `docker-compose*.yml`, `Dockerfile*`, `docker/nginx/nginx.conf`, `backend/start.sh` | unchanged in shape; optional services and Nginx blocks become conditional on enabled modules |

Infrastructure exposes **stable interfaces only where a provider is realistically swappable** (storage, mail, payments). Prisma and Redis are used directly — abstracting them would be over-engineering (D7).

### 2.4 Project Layer

Everything specific to one client:

| Concern | Where it lives (target) |
|---|---|
| Branding (name, legal name, logo, favicon, OG image, social links) | `project.config.ts` |
| Theme (palette tokens, fonts, Nuxt UI primary colour name) | `project.config.ts` → generated `brand.css` values and `app.config.ts` |
| Project configuration (slug, locales, default locale, currency, timezone, schema.org type) | `project.config.ts` |
| Enabled modules | `project.config.ts` |
| Client-specific pages (home, about, contact) | project Nuxt layer / `app/project/` |
| Client-specific business rules | project config values or a project-owned module |
| Client-specific components (`WhatsAppButton`, brand lockup, hero content) | project layer |
| Seed content (demo catalogue, initial settings values) | project seed, not the Core image |

---

## 3. Repository Structure

Target layout. **Reached incrementally** — no mass move is required or planned in one step. Existing paths remain valid until the phase that touches them.

```text
starter-system/
├── app/                          # Nuxt 4 application root (srcDir)
│   ├── core/                     # Core layer: auth, api client, permissions, admin shell, account shell
│   │   ├── components/
│   │   ├── composables/
│   │   ├── layouts/
│   │   ├── middleware/
│   │   ├── pages/                # login, forgot/reset password, auth/callback, account/index, admin/{staff,users,newsletter,notifications,settings}
│   │   ├── plugins/
│   │   ├── stores/
│   │   ├── i18n/
│   │   └── nuxt.config.ts        # layer config: component prefix, i18n files, app.config contributions
│   ├── modules/
│   │   └── ecommerce/            # one Nuxt layer per module, same internal shape as core/
│   │       ├── components/
│   │       ├── composables/
│   │       ├── pages/
│   │       ├── stores/
│   │       ├── types/
│   │       ├── i18n/
│   │       └── nuxt.config.ts
│   ├── project/                  # Project layer: branding, theme, client pages and components
│   │   ├── components/
│   │   ├── pages/                # index, about, contact
│   │   ├── assets/css/brand.css
│   │   ├── i18n/
│   │   ├── project.config.ts
│   │   └── nuxt.config.ts
│   ├── components/               # transitional: current flat components until moved into a layer
│   ├── composables/              # transitional
│   ├── layouts/                  # transitional
│   ├── pages/                    # transitional
│   ├── stores/                   # transitional
│   ├── utils/                    # transitional (business.ts → project/project.config.ts)
│   └── app.vue
│
├── backend/
│   └── src/
│       ├── core/                 # auth/ (incl. permissions), users/, staff/, profile/, settings/, notifications/, newsletter/, uploads/, config/, events/  (E3a — DONE)
│       ├── modules/
│       │   └── ecommerce/        # products/, categories/, favourites/, orders/, payments/, loyalty/, analytics/ (flat, E3a — DONE); ecommerce.module.ts + ecommerce-permissions.ts (E3b — DONE)
│       ├── infrastructure/       # prisma/, redis/, storage/, mail/, payments-provider/, health/, common/  (E2 — DONE)
│       ├── project/              # project config loader, project seed, project-specific providers
│       ├── app.module.ts         # composes core + enabled modules from project config
│       └── main.ts
│
├── backend/prisma/               # multi-file schema: the folder itself is the schema root (package.json `prisma.schema`, start.sh `--schema prisma`)
│   ├── core.prisma               # generator + datasource; Core models (DONE — seam 3b step 1)
│   ├── infrastructure.prisma     # technical persistence (DONE)
│   ├── ecommerce.prisma          # shop models + enums (DONE)
│   ├── project.prisma            # project-specific additions (when needed)
│   ├── migrations/               # single linear history (D11) — stays here; Prisma resolves it next to the datasource file
│   └── seed/                     # core seed (settings, owner) + per-module + project seeds (today: seed.ts)
│
├── docker/                       # nginx config (+ conditional blocks), TLS mount point
├── docs/                         # this blueprint and companions (tracked); docs/history/ for archived audits
├── scripts/                      # new-project bootstrap, boundary checks, schema-diff check
├── i18n/                         # transitional: current flat el.json / en.json until split per layer
├── .env.example
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

Notes:

- On the frontend, `core/`, `modules/*` and `project/` are **Nuxt layers** (`extends` in the root `nuxt.config.ts`). Nuxt only auto-scans standard directories, so each layer carries its own `components/`, `pages/`, etc. The root-level transitional folders become empty as files move and are then deleted.
- On the backend, `core/`, `modules/*`, `infrastructure/` and `project/` are folders under one Nest application. Modules are internal (D2), composed by `app.module.ts` from the enabled-modules list (D3).
- The root `types/index.ts` (all e-commerce wire types) moves into `app/modules/ecommerce/types/`; the core `Profile` type moves to `app/core/types/`.

---

## 4. Architectural Decisions

Summary table. Full rationale, prevented outcomes and deferrals per decision are in [ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md).

| ID | Decision | v1 Decision |
|---|---|---|
| D1 | Repository shape | Single repository starter system; frontend and backend remain two build roots; a shared `contracts` location holds project config and wire types |
| D2 | Module packaging | Internal modules (folders + Nuxt layers), not npm packages |
| D3 | Module enable/disable | Declared in project configuration; `app.module.ts` and root `nuxt.config.ts` read it |
| D4 | Role model | Generic lowercase string roles (`admin`, `customer` in Core; module presets such as `accountant`, `stock_manager`); capabilities registered by modules; `UserRole` enum retired — **done** |
| D5 | Content / localization | UI strings per layer via `@nuxtjs/i18n`; content localization is module-owned (e-commerce keeps column-per-locale in v1) |
| D6 | Tenancy | Single tenant per independent project |
| D7 | Provider abstraction | Interfaces/adapters only for storage, mail, payments; Prisma and Redis used directly — **implemented** (`StorageAdapter`, `PaymentProvider`; mail already in shape) |
| D8 | Event mechanism | Lightweight in-process event bus (`@nestjs/event-emitter` or equivalent); no queue |
| D9 | API contract | `useApi` is the single client; wire types live in a shared contracts location; snake_case over the wire stays |
| D10 | Configuration ownership | Core config + module config fragments + project config; env holds secrets only |
| D11 | Database / schema ownership | Multi-file Prisma schema per layer/module; single linear migration history |
| D12 | Enforcement | Typecheck, lint, unit tests, boundary checks on every pull request |
| D13 | Loyalty ownership / user extensions | `LoyaltyAccount` owns the balance, `loyalty/` is its only reader/writer; Core `UserExtensionsRegistry` lets modules add fields to user payloads; contracts preserved — **done** (seam 2) |

---

## 5. Dependency Rules

The complete, enforceable list is in [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md). Summary:

**Allowed:** `PROJECT → MODULE`, `PROJECT → CORE`, `MODULE → CORE`, `MODULE → INFRASTRUCTURE`, `CORE → INFRASTRUCTURE`, `INFRASTRUCTURE → external providers`.

**Forbidden:** `CORE → MODULE`, `CORE → PROJECT`, `INFRASTRUCTURE → anything above it`, `MODULE A → MODULE B internals`.

Modules talk to each other through public service interfaces, events, and explicit module contracts — never by importing another module's internal files, writing to its tables without a contract, or deleting its cache keys by string.

Frontend-specific: global layouts and shells never import module features; `useApi` is the only HTTP door and imports no store.

---

## 6. Core Ownership Rules

| Area | Owner |
|---|---|
| Authentication | Core |
| User identity / profile | Core |
| Generic roles / capabilities (mechanism) | Core |
| Capability and role *definitions* | Contributing module (via Permission Registry); Core defines only `owner` and `member` |
| Settings mechanism | Core |
| Settings *definitions* | Contributing module or project (via Settings Registry) |
| Notifications mechanism | Core |
| Notification *types* and rendering hints | Contributing module |
| Newsletter mechanism | Core |
| Domain business logic | Module |
| Provider SDK integration | Infrastructure |
| Client branding | Project |
| Client-specific business rules | Project configuration or a project-owned module |
| Admin shell, generic admin pages | Core |
| Module admin pages | Contributing module (registered via Admin Registry) |

**The Core `User` model must not own module-specific fields.** Specifically not: loyalty balances, orders, carts, wishlists/favourites, inventory data. The last such column, `User.loyaltyPoints`, was removed in seam 2: the balance is `LoyaltyAccount.points` (`ecommerce.prisma`, one row per user, absent row = 0). Modules reference users by `userId` and declare their own relations in their own schema file. A Prisma model is a single block, so the back-relation fields Prisma requires on `User` (`orders`, `favourites`, `loyaltyTransactions`, `loyaltyAccount`) are written in `core.prisma` next to the model; ownership of those relations stays with the module and is stated in a comment there.

Core services never read module-specific columns. Where a module needs its data shown next to a user in a client payload, it registers a **user extension** (`users/user-extensions.registry.ts`, seam 2): `{ id, order, scopes: ['profile' | 'customers'], extend(userIds) → Map<userId, fields> }`. Core applies the registered extensions at the points where a user object leaves for the client — `GET /profile`, `PATCH /profile`, login/register/refresh responses, `GET /admin/customers` — one query per extension per batch, never in the JWT strategy. The e-commerce module contributes `loyaltyPoints` (both scopes) and `_count.orders` (`customers` only), so the client-facing payloads kept every field they had before the column moved. Core never names the contributing module.

---

## 7. Registry System

A registry is a plain, typed collection that **modules contribute to and Core reads**. It is the only sanctioned way for Core to learn that a module exists. Registries are populated at composition time (backend: module registration; frontend: Nuxt `app.config` layer merge), are read-only afterwards, and are never mutated at runtime.

The pattern already exists implicitly: `PermissionsGuard` reads `RequirePermissions` metadata; `profile.me()` forwards `permissions[]` to the client; `staff`, `notifications`, `analytics` own their own `/admin/*` controllers. v1 names and generalises this. No plugin framework, no discovery, no dynamic loading — arrays and existing framework configuration only.

### 7.1 Essential for v1

| Registry | Contributors | Consumers | Static / runtime | Duplicate IDs | Disabled module |
|---|---|---|---|---|---|
| **Module Registry** — `{ id, version, backendModule, nuxtLayer, envSchema, contributes: {…} }` | Each module (one entry) | `app.module.ts` composition, root `nuxt.config.ts` `extends`, config loader, docs generator | Static (project config lists enabled ids) | Build/boot error | Entry absent → nothing below is contributed |
| **Permission Registry** — capabilities `{ id: 'verb:noun', description }` and role presets `{ role, capabilities[] }` | Core (roles `admin`/`customer`; capabilities `view:customers`, `manage:marketing`, `manage:settings`, `manage:staff`, `view:notifications`, `manage:media` — all registered), each module | `permissionsFor()`, `PermissionsGuard`, `profile.me()` → frontend `usePermissions` | Static | Boot error (two modules must not claim one capability id) | Its capabilities and role presets vanish; users holding a vanished role keep the string but resolve to no capabilities |
| **Admin Registry** — `{ id, path, capability, labelKey, subtitleKey, icon, order, group, activeMatch?, badgeStateKey?, enabled? }` — **implemented** (`docs/ADMIN-REGISTRY.md`) | Core (staff, users, newsletter, notifications, settings), each module | `layouts/admin.vue` nav and titles, `middleware/admin.ts` gating, landing-path resolution, dashboard widget list | Static (frontend `app.config` merge) | Build error | Sections absent; routes absent because the layer is not extended |
| **Settings Registry** — `{ key, type, default, group, labelKey, descriptionKey?, order?, public?, editable?, min?, max?, step?, unit? }` + groups — **implemented** (`docs/SETTINGS-REGISTRY.md`) | Core (none required in v1), each module (e-commerce: shipping + loyalty keys via `orders/pricing-settings.ts`) | `SettingsService.getAll()` (defaults applied), Core `GET /settings` (public keys only), `GET/PATCH /admin/settings` → registry-driven admin form; no seed rows | Static definitions; runtime values in DB | Boot error | Keys absent from public read and admin form; existing rows stay in DB untouched |
| **Event Registry / Event Bus** — `const Events = { 'user.registered': UserRegisteredPayload, … }` + emitter | Core emits identity events (`user.registered`, `user.authenticated`, `user.password_reset`); modules emit domain events (`order.created`, `order.paid`, `product.stock_changed`) | Any module subscribes; Core subscribes to nothing from modules | Static names, runtime dispatch | Type-level (a name maps to one payload type) | No emitters, no subscribers |
| **Navigation slots** (minimal) — `navItems[]`, `headerActions[]`, `globalWidgets[]`, `accountItems[]`, `accountCards[]` — **implemented (seam 9)** as `app.config` lists typed in `app/types/contributions.ts`; components referenced by registered name (`.global.vue`) | Modules and project via `app.config` (root `app.config.ts` until layers exist) | `AppHeader`, `AccountSidebar`, `account/index.vue`, `layouts/default.vue` (`AppFooter` still hard-codes its links — open) | Static | Build error | Absent |

### 7.2 Deferred

- Widget Registry (dashboard tiles with render functions) — v1 uses a fixed dashboard page reading a simple `dashboardCards[]` list from the Admin Registry.
- Email Template Registry — v1 keeps templates as functions inside the owning module; the transport takes `{ to, subject, html }`.
- Notification renderer registry — v1 renders `meta.titleKey` / `meta.bodyKey`.
- Advanced plugin discovery, runtime enable/disable, remote modules.

### 7.3 Lifecycle rules

1. A registry entry is declared next to the code it describes (inside the module), never centrally.
2. Registries are frozen after composition. Any code that mutates one at runtime is a bug.
3. The frontend receives registry data either at build time (`app.config` layer merge) or through `GET /profile` (permissions). No other channel.
4. Adding a registry requires a documented consumer in Core. A registry with no Core consumer does not exist.

---

## 8. Configuration Strategy

```text
CORE CONFIG      what Core needs to boot; validated by Core's Joi fragment
   ↓
MODULE CONFIG    what each enabled module needs; validated by that module's fragment
   ↓
PROJECT CONFIG   who this client is; committed, non-secret, drives generation
```

### 8.1 Environment variables — secrets and host-specific values

| Group | Variables | Required for |
|---|---|---|
| Core boot | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `NODE_ENV`, `PORT`, `APP_URL`, `CORS_ORIGINS`, `OWNER_EMAIL`, `OWNER_PASSWORD` (bootstrap only) | Always |
| Mail transport | `MAIL_TRANSPORT`, `SMTP_HOST`, `SMTP_PORT` or `RESEND_API_KEY`; `EMAIL_FROM` | Core (password reset) — always, but transport may be SMTP/Mailpit |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Only when the auth-google feature is enabled |
| Storage | `STORAGE_ENDPOINT`, `STORAGE_PORT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_PUBLIC_URL` (today `MINIO_*`) | Only when the media module is enabled |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (checkout is Stripe-hosted, so the frontend needs no publishable key) | Only when payments is enabled |
| Frontend | `NUXT_PUBLIC_API_BASE`, `NUXT_PUBLIC_SITE_URL` | Always |
| Compose | `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `REDIS_PASSWORD`; container/bucket names derived from `PROJECT_SLUG` | Deployment |

Today's `NUXT_URL` carries three meanings (CORS allow-list, OAuth return base, mail link base). It splits into `CORS_ORIGINS` and `APP_URL`. Today's `BRAND_NAME`, `BRAND_COLOR`, `BRAND_LOGO_URL` env vars move to project config (§8.2) and are handed to the backend by the config loader.

**Core-only boot requires none of the storage, payments or OAuth variables.** Implemented in `backend/src/core/config/env.validation.ts`: presence of a provider's lead key (`MINIO_ENDPOINT`, `STRIPE_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`/`MAIL_TRANSPORT=smtp`) switches that provider on and makes the rest of its keys required; empty strings count as unset. Per-module fragment *registration* (module registry) is still Phase 2.

### 8.2 Project configuration — non-secret identity, committed

`project.config.ts` (single source; consumed by both apps through the shared contracts location):

| Field group | Fields |
|---|---|
| Identity | `name`, `legalName`, `slug`, `tagline` |
| Locales | `locales[]`, `defaultLocale`, `currency`, `timezone` |
| Branding | `logo`, `logoInverted`, `favicon`, `ogImage`, `wordmarkAccent`, `social{}` |
| Theme | palette tokens (today `brand.css` values), `uiPrimary` (Nuxt UI colour name), font families |
| Contact | `phone`, `phoneDisplay`, `whatsapp`, `address{}`, `geo{}`, `displayHours[]`, `schemaHours[]`, `schemaType` |
| Modules | `modules: ['ecommerce', …]` and per-module options |
| Mail identity | `brandName`, `brandColor`, `brandLogoUrl` (derived from Branding) |

Generated from it: `brand.css` custom-property values, `app.config.ts` UI colour, i18n locale list in `nuxt.config.ts`, backend `BRAND_*` values, compose identifiers. Nothing in Core reads `BUSINESS` directly after Phase 3; it reads the loaded project config.

### 8.3 Module configuration — behaviour of an enabled module

Lives inside `project.config.ts` under `modules.<id>` for static choices (payment provider = `stripe`, storage provider = `minio`, currency, page size) and in the Settings Registry for runtime-editable values (shipping cost, free-shipping threshold, loyalty rates). A module reads both through its own typed config service; Core never reads module config.

---

## 9. Database Ownership

Ownership is expressed by which schema file declares the model (D11). **Layout (seam 3b step 1, done):** `backend/prisma/core.prisma`, `backend/prisma/infrastructure.prisma`, `backend/prisma/ecommerce.prisma`, with `backend/prisma/migrations/` unchanged beside them — the `prisma/` folder is the schema root. Every model block, including all of its relation fields, is complete inside one file; a model's *ownership* can differ from where a related model lives, but a model is never split across files.

| Owner | Models today | Target change |
|---|---|---|
| **Core** (`core.prisma`) | `User`, `Setting`, `NewsletterSubscriber`, `Notification` | `User` has no module columns (`loyaltyPoints` removed — **done**, seam 2 / D13); `User.role` is `String` (lowercase values, `UserRole` enum retired — **done**, D4); `Notification` becomes `{ type String, key String?, meta Json, isRead, createdAt }` — `productId`, `stock` and the `NotificationType` enum leave |
| **Infrastructure** (`infrastructure.prisma`) | `ProcessedEvent` | `orderId` → generic `subjectId String?` — **done** (`20260919120000_processed_event_subject`); stays the webhook idempotency ledger |
| **E-commerce module** (`ecommerce.prisma`) | `Product`, `Category`, `Favourite`, `Order`, `OrderItem`, `LoyaltyAccount`, `LoyaltyTransaction`, enums `OrderStatus`, `FulfillmentType`, `PaymentMethod`, `PaymentStatus`, `LoyaltyType` | `LoyaltyAccount { userId @id, points, updatedAt }` owns the balance (**done**, seam 2); written only by `src/loyalty/loyalty.service.ts`, always together with a `LoyaltyTransaction`. Its relation fields on `User` (`orders`, `favourites`, `loyaltyTransactions`, `loyaltyAccount`) are written inside the `User` block in `core.prisma` (one model = one block) and marked there as shop-owned |
| ~~**Dead**~~ | ~~`RefreshToken`~~ | **Removed** (hardening milestone, migration `20260919110000_drop_refresh_tokens`). Refresh tokens live in Redis (`refresh:{userId}:{jti}`) |

Models the task template names that **do not exist** in this repository and are not planned for v1: `Cart`, `CartItem` (cart is client-side Pinia state, persisted in the browser), `Wishlist`, `WishlistItem` (the equivalent is `Favourite`), inventory models beyond `Product.stock`, analytics records (analytics is computed from orders). If a future module adds them, they belong in that module's schema file.

Rules:

- Core owns identity. Modules own domain data. Infrastructure owns technical persistence (idempotency, ledgers).
- Project-specific schema additions go in `project.prisma` and must not alter Core or module models; they may add models that reference Core ids.
- Migrations remain one linear history in `prisma/migrations/`. A commit that changes a module's schema is owned by that module and is never cherry-picked downstream without its migration.
- No Core service reads a module column. No module writes a Core column except through a Core service or an event handler that Core exposes for that purpose.

---

## 10. Frontend Architecture

### 10.1 Ownership

| Layer | Owns |
|---|---|
| **Core frontend** | `useApi` (single HTTP client), `stores/auth`, `plugins/auth.*`, `middleware/{auth,guest,admin}`, `usePermissions` (mechanism + registry reader), auth pages, account shell (`AccountSidebar`, `account/index` composed from `accountItems[]`), admin shell (`layouts/admin.vue`, `admin.css` shell + `.ac-*` primitives, `DateRangeControl`, `AdminInfo`), generic admin pages (staff, users, newsletter, notifications, settings-from-registry), `useAdminNotifications`, header/footer/default-layout **shells** with slots, `Brand*` components (mechanism), `useBusinessSchema` and `useOpeningHours` (mechanism), shared utilities, core `Profile` type, core i18n namespaces |
| **Module frontend (e-commerce)** | `stores/{cart,favourites,filters}`, `useProducts`, `useCurrency`, `components/{product,cart,checkout,filters,loyalty}` (all `Shop*`-named since E5c), `admin/ShopProductDrawer`, pages `products/*`, `checkout/*`, `brands`, `account/{orders,favourites,loyalty}`, admin `index` dashboard content, `analytics`, `products`, `categories`, `orders`; e-commerce wire types; e-commerce i18n namespaces; its `navItems`, `headerActions` (cart button), `globalWidgets` (`CartDrawer`), `accountItems`, `adminSections` |
| **Project frontend** | `pages/{index,about,contact}`, `WhatsAppButton`, `brand.css` values, fonts, `project.config.ts`, project i18n namespaces (`home`, `hero`, `about`, `contact`, `testimonials`), any client-specific layouts or workflows |

### 10.2 Rules

1. **Global layouts and shells must not import optional-module features.** **Done (seam 9)** for `layouts/default.vue`, `AppHeader`, `AccountSidebar` and `account/index.vue`: they read `app.config` lists through `useAppConfig()` and render contributed components by registered name; the former violations (`CartDrawer` mount, `useCartStore`/`useFiltersStore`/`useState('cart-open')` in the header, hard-coded shop routes and `loyalty.*` keys in the account shell) are gone. `AppFooter` still hard-codes shop links (open, same mechanism).
2. **Module navigation is contributed through registries** (`navItems`, `headerActions`, `globalWidgets`, `accountItems`, `accountCards`), never by editing a Core component. Contributed components use the `.global.vue` suffix so Nuxt registers them globally (see DEPENDENCY-RULES §5.2 and the Module Development Guide §3.5).
3. **Module admin sections are contributed through the Admin Registry**; the layout, the middleware and the landing-path logic read it. The three hand-maintained copies (`layouts/admin.vue`, `usePermissions.SECTION_CAPS`, backend `permissions.ts`) collapse into one.
4. **`useApi` is the only standard HTTP entry point.** It owns `apiBase`, `credentials: 'include'`, and 401 → single-flight refresh → retry. Raw `$fetch`/`useFetch` against the API is allowed only in `useApi` itself and in the SSR auth plugin, with a comment stating why. Today 27 files read `apiBase` and every admin page calls `$fetch` directly; they migrate in Phase 1.
5. **`useApi` must not import or mutate Pinia stores.** It exposes an `onUnauthenticated` hook; the auth plugin registers the store reset. This breaks the current `useApi ↔ useAuthStore` cycle.
6. **Avoid flat component namespace collisions.** When layers are introduced, `components.pathPrefix: false` is replaced by a per-layer prefix (`Core*`, `Shop*`, `Project*`) or by `pathPrefix: true`. Silent last-wins overrides between layers are forbidden.
7. **Shared UI state by string key** (`useState('…')`) is owned by the layer that defines the key and is exposed through a composable; Core never reads a module's key.
8. Pages that require auth or admin declare it with `definePageMeta({ middleware })`; the SSR/CSR split of the guards is a Core decision and is not overridden per page.

### 10.3 Minimum frontend architecture for v1

Two layers (`core`, `ecommerce`) plus a `project` layer; `useApi` as the single client with the hook; `app.config`-merged lists for admin sections, nav items, header actions, account items, global widgets; per-layer component prefix; per-layer i18n files; `Profile` core type with module augmentation (backend side done in seam 2 via `UserExtensionsRegistry`; the frontend `Profile` type still declares `loyalty_points` inline until layers split the types); `project.config.ts` feeding branding, locales and currency.

---

## 11. E-commerce Separation Plan

The ten seams, in the order they should be cut. Each leaves the system bootable. File references are current locations.

| # | Seam | Today | Target owner | Migration risk |
|---|---|---|---|---|
| 1 | **Remove guest-order linking from Core Auth** — **DONE** | Was `AuthService.linkGuestOrders()` over `order`, `loyaltyTransaction`, `user.loyaltyPoints`, `setting` on register/login/Google login | `backend/src/core/events/` (`CoreEventBus`, `user.authenticated`); `backend/src/orders/guest-order-linker.service.ts` subscribes and awards points (since seam 2 through `loyalty/loyalty.service.ts`) | Emit is awaited, so the user object returned by login still reflects the linked orders. Failure policy applies: a subscriber error is logged and login succeeds (previously it would have failed the request). Earn rate now read via `SettingsService.loadPricing()` like order creation |
| 2 | **Move loyalty ownership out of User** — **DONE** | Was the `User.loyaltyPoints` column, selected in `users.service` (4×, incl. `listCustomers` with `_count.orders`), written inline by `orders`, `payments` and the guest-order linker; `GET /profile/loyalty` and a `loyaltyTransaction` read in Core `profile` | `backend/src/loyalty/`: `LoyaltyAccount` table owns the balance; `LoyaltyService` (`balance`, `balances`, `history`, `earn`/`earnWrites`, `redeem`) is the only writer of both loyalty tables; `LoyaltyController` keeps `GET /profile/loyalty` (path and response unchanged — the `/loyalty/*` rename was declined as a needless contract change). Core gained `UserExtensionsRegistry`; the loyalty module contributes `loyaltyPoints`, the orders module `_count.orders`, so `/profile`, login/register/refresh and `/admin/customers` keep their fields. Earn/redeem arithmetic, `loyalty_min_redeem`, linked-order awards and the webhook's ProcessedEvent idempotency unchanged; frontend untouched | Shipped as **one atomic, data-preserving migration** (`20260917100000_loyalty_account`: create table → backfill every user → drop column; no dual-write phase — `start.sh` migrates before boot, so there is no rolling window). Rehearsed on a scratch copy: per-user balances identical, zero drift. Ships whole under the client-clone rule (D13). Only observable wire difference: `loyalty_points` moves later in the JSON key order |
| 3a | **Permission Registry: capability and staff-role vocabulary out of Core** — **DONE (code)** | Was `auth/permissions.ts` hard-coding all ten capabilities and the `ACCOUNTANT`/`STOCK_MANAGER` presets | Core keeps the mechanism: `auth/permissions.registry.service.ts` (`defineCapabilities(ids, {order})`, `defineRolePreset(role, caps)`, `permissionsFor()`, `staffRoles()`; duplicate registration and a preset naming an unregistered capability fail boot), provided globally by `auth/permissions.module.ts`; `PermissionsGuard` and `ProfileService` read it. Core registers only `view:customers`, `manage:marketing`, `manage:settings`, `manage:staff`. Modules register their own: `products/catalog-permissions.ts` (`view:catalog`, `manage:catalog`, `manage:inventory`), `orders/orders-permissions.ts` (`view:orders`, `manage:orders` + the `ACCOUNTANT` and `STOCK_MANAGER` presets), `analytics/analytics-permissions.ts` (`view:finance`). Merged order is deterministic (`order`, then registration), so `/profile.permissions` is byte-identical to before | Frontend `usePermissions.STAFF_ROLES` and `SECTION_CAPS` remain hand-duplicated until the Phase 2 Admin Registry. `orders-permissions.ts` hosts the shop presets only because e-commerce has no single root yet; it moves to `ecommerce.module.ts` with the folder layers |
| 3b | **`UserRole` enum → `role String`** — **DONE** (step 1 schema split; step 2 role-type migration) | Was the `UserRole` enum (`CUSTOMER`, `ADMIN`, `ACCOUNTANT`, `STOCK_MANAGER`) mapped to lowercase DB labels, `UserRole.*` in `staff.service`, `'CUSTOMER'` literals in `users.service` and `analytics.service`, the dead `AdminGuard` | `users.role` is `text NOT NULL DEFAULT 'customer'`; values `customer/admin/accountant/stock_manager` preserved verbatim. Core: `OWNER_ROLE = 'admin'`, `MEMBER_ROLE = 'customer'` (`auth/permissions.ts`); e-commerce registers `accountant`, `stock_manager` (`orders/orders-permissions.ts`). Staff DTO accepts upper- or lowercase input and persists lowercase, so the frontend contract is unchanged. Migration `20260916100000_user_role_enum_to_text` is hand-written and data-preserving (see D4 migration contract) | Deploy atomically: schema + migration + code ship together, never cherry-picked partially (client-clone rule). Old JWTs carrying `ADMIN` are harmless (authorization re-reads the user per request). Frontend `usePermissions.STAFF_ROLES` duplication remains for the Phase 2 Admin Registry |
| 4 | **Move shop settings definitions into E-commerce** — **DONE (code)** | Was `SettingsService.PRICING_SETTING_KEYS`, `loadPricing()`, the duplicate admin allowlist, and the public `GET /settings` in Core | Core `SettingsService` is generic: `define(definitions)` (registry, duplicate key = boot error), `definitions()`, `getAll()` (cached), `invalidate()`, admin read/write with the registered keys as the allowlist (`settings/setting-definition.ts`). The orders module owns the pricing definitions (`orders/pricing-settings.ts`), the validated fail-loud `loadPricing()` (`orders/pricing-settings.service.ts`, registers on init) and the public `GET /settings` (`orders/pricing-settings.controller.ts`); `orders`, `loyalty` and `payments` read through it (payments no longer has a silent `100` fallback) | **Residue closed (Settings Registry):** the seed no longer writes settings (defaults live in the definitions and are applied on read); the admin form renders from `GET /admin/settings` `{ groups, definitions, values }`; the public `GET /settings` moved to Core `settings/settings.controller.ts`, filtered by `public` |
| 5 | **Separate generic email/notification mechanisms from shop templates** — **DONE (code)** | Was `MailService.sendOrderConfirmation`; `NotificationsService.checkStock`, `LOW_STOCK_THRESHOLD`, `StockProduct` | Mail: `MailService` keeps transport, `renderLayout()`, `buttonStyle()`, `brand` and a generic `sendMail(message, label)` with the same catch-and-log semantics; the order template lives in `orders/order-confirmation.mail.ts`. Notifications: `NotificationsService` keeps only domain-free primitives (`findOpen`, `create`, `update`, `resolveOpen`) plus the inbox; the stock rule lives in `products/stock-alerts.service.ts`, used by products and orders | **Capability residue DONE:** Core registers `view:notifications` and the inbox controller requires it; the `stock_manager` preset carries it, so access is unchanged (owner and stock manager in, accountant out). **Schema residue open:** the `NotificationType` enum still has only `LOW_STOCK`/`OUT_OF_STOCK`, and `Notification.productId`/`stock` are still product-shaped columns rather than `key`/`meta` — a schema step, no longer tracked by the boundary baseline |
| 6 | **Move Stripe business logic behind Payments** — **DONE** | Was `payments.service` instantiating the SDK, building line items, creating coupons and parsing the webhook; `main.ts` sets `rawBody: true` for it | `backend/src/payments-provider/` (Infrastructure): `PaymentProvider` (`isEnabled`, `assertEnabled`, `createCheckout`, `getCheckoutStatus`, `parseWebhook` → neutral `WebhookEvent`) with `StripePaymentProvider` as the only implementation — SDK client, coupon/session calls with the unchanged idempotency keys, `order_id`/`user_id` metadata, signature check. `PaymentsService` keeps orchestration: order/owner/method checks, line shaping, the ProcessedEvent-first settlement transaction and loyalty award. `rawBody` stays documented in `main.ts` | Routes, DTOs, error messages, raw `payment_status`, env names and the `stripe*` order columns unchanged; recorded provider calls and DB effects identical before/after, including duplicate delivery and invalid signatures |
| 7 | **Move MinIO/storage logic behind Storage/Media** — **DONE** (step 1 adapter, step 2 capability) | Was `MinioService` used directly by `products`, `favourites`, `orders`, `uploads`; three inline copies of "presign first image"; `isExternalUrl` duplicated; the upload endpoint guarded by the shop's `manage:catalog` | Step 1: `backend/src/storage/` (Infrastructure) — `StorageAdapter` (`isEnabled`, `put`, `resolve(refs[], expiry?)`, `presign`) with `MinioStorageAdapter`; callers inject the adapter and call `resolve` once; `minio/` removed. Step 2: Core registers `manage:media`, `UploadsController` requires it, the `stock_manager` preset carries it (owner and stock manager upload, accountant does not). `uploads/` stays a Core folder; the `media/` sub-domain folder is the Phase 2 layout move | `Product.images` still stores object keys; external URLs pass through; 3600 s presign and `MINIO_PUBLIC_URL` rewrite unchanged; `MINIO_*` env names and the nginx `/media/` block untouched; upload response and validation messages identical |
| 8 | **Separate shop cache namespaces** — **DONE** | Was `categories.service` deleting `products:*` and `orders.service` deleting `analytics:*` by pattern string | `ProductsService.invalidate()` (`products:*`) and `AnalyticsService.invalidate()` (`analytics:*`); `CategoriesService.invalidateCatalog()` calls the products owner then drops its own `categories:tree`; `OrdersService` calls the analytics owner fire-and-forget. Key strings, TTLs and triggers unchanged; recorded Redis call sequences identical before/after | The `<module>:<entity>:<id>:<field>` key convention is still a documented convention, not a rename; it becomes enforceable with the §6.6 grep check |
| 9 | **Remove shop dependencies from global frontend layouts** — **DONE** | Was `layouts/default.vue` → `CartDrawer`; `AppHeader` → cart/filters stores + `cart-open` state + hardcoded shop nav; `AccountSidebar` + `account/index` → shop routes and keys | Config-driven shell contributions: `app.config` lists `navItems`, `headerActions` (with `area`), `globalWidgets`, `accountItems`, `accountCards` typed in `app/types/contributions.ts`; shells render `<component :is>` by registered name; contributed components `CartButton`, `HeaderSearch`, `CartDrawer`, `LoyaltyCard`, `AccountStats` carry the `.global.vue` suffix; `useCartDrawer()` owns the `cart-open` key | Rendered output unchanged: SSR HTML byte-identical apart from `v-for` fragment markers; header nav, search, cart badge/bounce, drawer, sidebar and dashboard verified in a headless browser with the same console/hydration output as before. Entries move from the root `app.config.ts` into the e-commerce layer's `app.config.ts` in Phase 2 with no shell change |
| 10 | **Split the God Admin service** — **DONE** | Was `backend/src/admin/admin.service.ts` (515 lines) | Newsletter → `newsletter`, settings → `settings`, customers → `users`, orders → `orders`, categories → `categories` (+ DTO), products → `products` (+ DTO), stats → `analytics`; each with its own `admin/*` controller. `admin/` folder removed | Done in seven verbatim moves + one deletion; route inventory (57 routes, guards, capabilities) identical before and after every step. Route paths kept (`/admin/customers` not renamed) |

Dead code removed alongside (no seam, just deletion in Phase 1) — **DONE**: `AdminGuard` (seam 3b); `RefreshToken` model + table, `plugins/stripe.client.ts` `$stripe` provide (+ `@stripe/stripe-js`, `STRIPE_PUBLISHABLE_KEY`), root `stripe`/`resend`/`zod` dependencies, `runtimeConfig` secret keys in `nuxt.config.ts`, `app/types/database.types.ts`, `pages/confirm.vue`, `pages/admin/products/[id].vue`, `app/package.json` (hardening milestone). Stale `.nuxt` folders are untracked build output.

---

## 12. Architecture Enforcement

> **Architecture rules are not complete until they are enforceable automatically.**

### 12.1 Verification workflow (implemented)

Backend: `npm run verify` (in `backend/`), also run by `.github/workflows/verify.yml` on every pull request and push to `main`. Its purpose is to make every seam cut in §11 mechanically checkable, so a later change cannot silently reopen it. The stages run **in this order** and the chain stops at the first failure:

| # | Stage | Command | Why this position |
|---|---|---|---|
| 1 | Typecheck | `npm run typecheck` (`tsc --noEmit`) | cheapest signal; fails before anything is built |
| 2 | Build | `npm run build` (`nest build` → `dist/`) | stages 4–5 compose the application from `dist/` |
| 3 | Boundary verification | `npm run verify:boundaries` | source-tree rules ([DEPENDENCY-RULES.md](DEPENDENCY-RULES.md) §10); the seam-tracked baseline is now **empty**, so any Core/Infra→shop import, shop capability on a Core controller or shop model in a Core service fails the gate; needs no build but runs after it so a broken build never masks a boundary error |
| 4 | Route verification | `npm run verify:routes` | composes the Nest DI graph without `init()` (no database or provider connection), enumerates every route with guards and capabilities, rejects duplicates, and diffs against the committed snapshot |
| 5 | Provider verification | `npm run verify:providers` | boots core-only, three partial, full and resend environments in child processes and asserts enabled/disabled state and 503 behaviour |

**Route snapshot.** `backend/scripts/route-inventory.snapshot.txt` is the committed inventory (57 routes at the time of writing): one sorted line per route with method, path, owning controller, guards and capabilities. Any drift — a route added, removed, moved to another controller, or re-guarded — fails stage 4 with a `+`/`-` diff. When the change is intentional, run `npm run verify:routes:update`, review the snapshot diff in the pull request, and commit it with the code. The snapshot is the public-contract record for the API; it is never updated without the diff being read.

The scripts are dependency-free Node (`backend/scripts/*.js`), set their own environment stubs, and open no network connection. They were used to prove every commit of the admin-service extraction (§11 seam 10) before being committed.

### 12.2 Gates still to add

| Gate | Frontend | Backend |
|---|---|---|
| Typecheck | `nuxi typecheck` (needs `vue-tsc`; four `~/types` imports are already broken) | done |
| Lint | `eslint .` (script exists; `eslint` is only a transitive dependency, so it fails) | ESLint with Nest/TS config (none) |
| Unit tests | Vitest on `useApi` (401 flow, hook), `usePermissions` | Jest on `AuthService` (token issue/refresh/rotation), `PermissionsGuard`, `SettingsService`, event wiring |
| Boundary / import validation on the target layout | `dependency-cruiser` once `core/`, `modules/`, `infrastructure/` exist | same |
| Schema check | — | Split verified with `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel prisma` (empty) and DMMF equality; a migrations-history diff needs a shadow database and is still to be wired; migrations linear |
| CI coverage | frontend build + lint + typecheck job | done (backend job) |

Phase 4 delivers the remaining gates. Seams 2, 3, 5 and 8 do not start without §12.1 green.

---

## 13. Migration Phases

Each phase ends with a bootable, deployable system. Phases are sequential; steps inside a phase may be reordered.

### Phase 0 — Documentation and Guardrails (this step)

- This blueprint, [ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md), [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md), [MODULE-DEVELOPMENT-GUIDE.md](MODULE-DEVELOPMENT-GUIDE.md).
- Architecture decision records (D1–D12).
- AI-agent instructions: root `AGENTS.md` (authoritative, tracked); `.claude/CLAUDE.md` points to it.
- Initial quality gate definitions (§12) written; `docs/ARCHITECTURE-CHECKLIST.md` in use; local run of typecheck + boundary check before Phase 1.

### Phase 1 — Core Cleanup

- Remove dead code (list in §11) — **DONE** (`AdminGuard` in seam 3b, the rest in the hardening milestone; `RefreshToken` dropped by migration `20260919110000_drop_refresh_tokens`).
- Add the event bus (D8) — **DONE**: `backend/src/core/events/` (`CoreEventBus`, typed `CoreEventMap`, first event `user.authenticated`).
- Remove shop logic from Auth (seam 1) — **DONE**: `AuthService` emits `user.authenticated`; `orders/guest-order-linker.service.ts` subscribes and awards points (since seam 2 through `loyalty/loyalty.service.ts`).
- Remove shop-specific roles from Core (seam 3) — **DONE**: 3a made the capability/role vocabulary a module-fed registry (`auth/permissions.registry.service.ts`); 3b replaced the `UserRole` enum with a lowercase `role String` via a hand-written, data-preserving migration. Core roles `admin`/`customer`; module roles `accountant`/`stock_manager`; new modules add roles by registration, not schema. Frontend `STAFF_ROLES` duplication stays for Phase 2; `orders-permissions.ts` may move with the folder/layer structure.
- Make optional providers optional — **DONE (backend)**: `core/config/env.validation.ts` holds the core schema plus conditional provider fragments (the runtime presence rule of each provider lives with the provider since F1: `storage/storage.module.ts`, `payments-provider/stripe.provider.ts`, `mail/mail.service.ts`); the storage adapter's MinIO client, the payment provider's Stripe client, Resend transport and Google strategy are instantiated only when configured and fail with 503 when used unconfigured; `rawBody` documented in `main.ts`. Still open: Nginx `/media/` block is unconditional (Docker config, separate step); frontend still renders the Google button regardless.
- Split the admin God Service (seam 10) — **DONE**.
- Separate the Core settings mechanism (seam 4) — **DONE**; the seed and admin-form residue closed by the Settings Registry (`docs/SETTINGS-REGISTRY.md`).
- Separate mail/notification mechanisms from shop templates (seam 5) — **DONE (code + capability)**: the inbox is guarded by Core's `view:notifications`; remaining residue = `NotificationType` enum and `Notification.productId`/`stock` columns, deferred to the schema step.
- Remove global frontend shop coupling (seam 9) — **DONE**: the shells are config-driven — `app.config` contribution lists (`navItems`, `headerActions`, `globalWidgets`, `accountItems`, `accountCards`) read via `useAppConfig()` and rendered by registered component name (`.global.vue`); no Core shell imports a shop store, component, state key or i18n key. Open residue: `AppFooter` links; `header.search_placeholder` read by the shop search component.
- Fix the `useApi ↔ useAuthStore` cycle — **DONE** (`api:unauthenticated` Nuxt hook + `plugins/auth-hooks.ts`); migrate raw `$fetch` calls to `useApi` — **DONE** (`docs/USEAPI-MIGRATION.md`; one justified SSR exception; refresh single-flight made per-tab).
- Introduce backend folder layers (`core/`, `modules/ecommerce/`, `infrastructure/`) — **DONE (E2 + E3a pure moves; E3b `EcommerceModule` root with the shop role presets)**; the multi-file Prisma schema — **DONE (seam 3b step 1)**: `backend/prisma/{core,infrastructure,ecommerce}.prisma`, `migrations/` in place, datamodel diff empty, no migration created. Seam 3b step 2 (`UserRole` enum → `role String` migration) remains open.

### Phase 2 — Registries and Module Boundaries

- Module Registry and enabled-modules composition in `app.module.ts` / root `nuxt.config.ts`.
- Permission Registry (capabilities + role presets); frontend reads from `/profile` only.
- Admin Registry — **DONE** (`docs/ADMIN-REGISTRY.md`): `app.config.adminSections` / `adminGroups` typed in `app/types/contributions.ts`; `layouts/admin.vue`, `middleware/admin.ts` and `usePermissions` read it; no section, path or capability named in Core; `pnpm test` covers the helpers.
- Settings Registry — **DONE** (`docs/SETTINGS-REGISTRY.md`): definitions with defaults/constraints/groups registered by modules; admin form renders from `GET /admin/settings`; defaults applied on read, so the seed writes no settings rows.
- Event Registry (typed names) on top of the Phase 1 bus.
- Module-driven frontend navigation: the lists exist (seam 9); Phase 2 moves the shop entries from the root `app.config.ts` into the e-commerce layer's `app.config.ts` and gives `AppFooter` the same treatment.
- Nuxt layers: `app/core`, `app/modules/ecommerce`; component prefixing; per-layer i18n.
- Loyalty extraction (seam 2), storage adapter (seam 7), payments provider surface (seam 6) and cache namespace hygiene (seam 8) — **all DONE** ahead of the layer split on the flat layout: `backend/src/modules/ecommerce/loyalty/` owns `LoyaltyAccount` + ledger with Core's `UserExtensionsRegistry` (D13); `backend/src/infrastructure/storage/` and `backend/src/infrastructure/payments-provider/` are the D7 adapters (moved under `infrastructure/` in E2, 2026-09-20); cache owners expose `invalidate()`. The seam table (§11) has no open rows; the boundary baseline is empty. The layer split of the folders is done (E2, E3a: `infrastructure/`, `core/`, `modules/ecommerce/`; `uploads/` stays Core); what remains is the shop root module (E3b) and the Module Registry composition (E8).

### Phase 3 — Project Configuration

- `project.config.ts` in the shared contracts location; `BUSINESS`, `brand.css` values, `app.config` colour, backend `BRAND_*`, compose identifiers generated or read from it.
- Module enable/disable driven by it end-to-end.
- Branding/theme, locale, currency and provider selection through it.
- `app/project` layer holding home/about/contact and project components.
- Project seed separated from the Core image.

### Phase 4 — Quality and Reusability

- Unit tests per §12; boundary checks; lint on both sides; typecheck on both sides.
- CI pipeline on pull requests.
- Module development guide validated by building one small non-shop module (e.g. a contact-form or blog stub) against the rules.
- New-project cloning guide (`scripts/new-project`), downstream reconciliation policy generalised from `PETSHOPCY-MANUAL.md`.

---

## 14. Risks and Explicit Deferrals

### 14.1 Risks

| Risk | Where | Mitigation |
|---|---|---|
| **Role migration deployed partially** (code without migration, or migration without code) locks every staff account out of a live client clone | Seam 3 — done | Shipped as one atomic commit; rehearsed on a disposable database; client-clone rule in `PETSHOPCY-MANUAL.md`: schema, migration and role literals ship together, never cherry-picked partially |
| **Localization schema migration** — a future JSON-column or translations-table move for `Product`/`Category` touches every consumer (25 inline `locale === 'el'` ternaries today) | D5 | v1 keeps column-per-locale inside e-commerce; introduce a `useLocalized()` helper first so the eventual change is one place |
| **Prisma schema ownership** — a future edit re-introduces a Core→module column, or the folder layout drifts (Prisma expects `migrations/` beside the file holding `datasource`; `package.json#prisma` is deprecated in Prisma 7 → `prisma.config.ts`) | Phase 1 | datamodel-diff + DMMF check reused per schema change; `--schema prisma` in `start.sh` because the runner image has no `package.json` |
| **Frontend flat namespace** — layer components silently override each other | Phase 2 | Prefix rule before the first layer is created; build fails on duplicate names |
| **Cache invalidation coupling** — string-keyed cross-module deletes survive the split | Seam 8 — done | Per-module `invalidate()` in place; grep-based check for `delPattern('` outside the owning module still planned (§10) |
| **Provider abstraction over-engineered** — interfaces for Prisma/Redis, or a generic provider framework | D7 | Interfaces only for storage, mail, payments; each with exactly one v1 implementation |
| **Event bus becomes too complex** — sagas, retries, outbox tables | D8 | In-process emitter; synchronous by default; no persistence; handlers are idempotent because they already are (`ProcessedEvent` pattern) |
| **Excessive module fragmentation** — six e-commerce modules before any project needs them apart | §2.2 | One `ecommerce` module with internal sub-folders; promote only on demand |
| **Enforcement lag** — refactor proceeds without gates and drifts | D12 | Typecheck + boundary check run locally before Phase 1; CI by Phase 4 at the latest |
| **Documentation drift** — this blueprint becomes the fourth untracked audit | §16 | `docs/` must be tracked; blueprint declares itself canonical |
| **Two package managers** (pnpm root, npm backend) complicate a shared contracts location | D1 | Contracts as a plain folder both roots reference by path in v1; unify package managers only if it blocks |

### 14.2 Explicit deferrals (not in v1)

npm packages for modules · microservices · multi-tenancy · Kubernetes · plugin marketplace / runtime module loading · full CMS · generic workflow engine · advanced event infrastructure (queues, outbox, sagas) · DB-driven branding · widget and email-template registries · product variants, VAT, refunds, restock-on-cancel (shop features, not architecture) · email verification, 2FA, lockout (Core features, not architecture) · automated TLS renewal and backups (ops).

---

## 15. Glossary

| Term | Meaning |
|---|---|
| Core | Layer that boots with no modules enabled |
| Module | Optional domain package: backend folder + Nuxt layer + schema file + registry contributions |
| Sub-domain | Internal folder of a module (e.g. `ecommerce/catalog`) with its own public index |
| Registry | Typed static collection contributed by modules, consumed by Core |
| Adapter | Infrastructure implementation of a stable interface (storage, mail, payments) |
| Project | The client-specific layer: config, branding, pages, components |
| Seam | A place where Core currently depends on shop code or data; cut in Phase 1–2 |
| Contract | A module's public surface: exported services, events, DTOs, registry entries |

---

## 16. Housekeeping Status

Non-architectural items that blocked the blueprint from being effective. Resolved in the documentation-and-guardrails step (Step 5) unless marked open.

| Item | Status |
|---|---|
| `docs/` was gitignored, so this blueprint was untracked | **Resolved.** `.gitignore` now ignores only `docs/blueprint/` (AI scratch notes); official documents under `docs/` are tracked |
| No root-level instruction file for AI agents | **Resolved.** `AGENTS.md` is the authoritative agent instruction file; `.claude/CLAUDE.md` (untracked, per machine) points to it and is subordinate |
| `.claude/skills/admin-panel.md` documented a different project | **Resolved.** Renamed to `.claude/skills/LEGACY-kzproducts-admin-panel.md` with a deprecation header; its one reusable idea (a navigation config array) is the Admin Registry in §7 |
| `.claude/AUDIT_REPORT.md` (PetShopCY, 2026-05-20) read as current | **Resolved.** Renamed to `.claude/HISTORY-2026-05-20-petshopcy-audit.md` with a historical header |
| `README.md` linked a non-existent `DEPLOY.md` and listed outdated versions | **Resolved.** Architecture section added; versions corrected; deployment section rewritten against the real compose file |
| `COMMERCIAL-AUDIT.md` (tracked, dated) sat at the repository root | **Resolved.** Moved to `docs/history/COMMERCIAL-AUDIT-2026-09-08.md` with a historical header. `.dockerignore` still lists the old root path; harmless, cleaned up when Docker config is next touched |
| `docs/blueprint/EXTRACTED-PATTERNS.md` (66 KB scratch extraction) | **Open.** Still ignored under `docs/blueprint/`; delete or promote to `docs/history/` when its content has been absorbed |
| Compliance checklist for every task | **Resolved.** `docs/ARCHITECTURE-CHECKLIST.md` |
