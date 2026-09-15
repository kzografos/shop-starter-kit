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
| Authentication | Cookie JWT + Redis-backed refresh rotation, Google OAuth, password reset — `backend/src/auth/`, `app/plugins/auth.*`, `app/middleware/*`, auth pages |
| Users | Identity, profile, staff management — `backend/src/users/`, `profile/`, `staff/` |
| Generic roles & capabilities | `PermissionsGuard`, `RequirePermissions`, `permissionsFor()` mechanism — `backend/src/auth/guards`, `auth/decorators`; frontend `usePermissions` mechanism |
| Settings mechanism | Key/value table, cached read, invalidate-on-write — `backend/src/settings/` |
| Notifications mechanism | Inbox, unread count, mark-read — `backend/src/notifications/` (generic parts) |
| Newsletter / subscribers | `backend/src/newsletter/`, `app/pages/unsubscribe.vue` |
| Database foundation | `PrismaService`; the core schema file |
| Configuration | Env validation (Joi) with per-module fragments; the loader for project config |
| Validation | Global `ValidationPipe`, DTO conventions |
| Error handling | `GlobalExceptionFilter` |
| Logging | `nestjs-pino` with redaction |
| Generic events | In-process event bus — `backend/src/core/events/` (`CoreEventBus`, typed `CoreEventMap`); first event `user.authenticated` |
| API foundation | CORS, helmet, cookie-parser, throttler, snake_case response interceptor; frontend `useApi` |
| Admin shell | `app/layouts/admin.vue`, `admin.css`, generic admin pages (staff, customers/users, newsletter, notifications, settings) |
| Health | `backend/src/health/` |

**Core MUST NOT depend on:** e-commerce, products, orders, cart, wishlist/favourites, loyalty, shipping, inventory, Stripe-specific business logic, MinIO-specific business logic, client-specific branding values.

Core may *know* that modules exist only through the registries in §7. It never names a module.

### 2.2 Optional Modules

Domain and business functionality that a given project may or may not need. A module is self-contained: its own backend folder, its own Nuxt layer, its own Prisma schema file, its own i18n files, its own env fragment, its own registry contributions.

Initial planned domains:

| Module | Status |
|---|---|
| E-commerce | Exists; needs extraction (§11) |
| Payments | Exists inside e-commerce; becomes a provider-facing module |
| Storage / media | Exists as `uploads` + MinIO service; becomes a module over a storage adapter |
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
| Redis | `RedisService` (`set` with mandatory TTL, `get`, `del`, `exists`, `delPattern`) | unchanged; add per-namespace invalidation helpers |
| Object storage | `MinioService` (put, presign, resolve refs) | `StorageAdapter` interface with a MinIO implementation; callers never see keys-vs-URLs logic |
| Email provider | `MailService` (Resend or SMTP transport + branded layout) | `MailTransport` interface; layout stays; templates leave |
| Payment providers | Stripe SDK instantiated inside `payments.service` | `PaymentProvider` surface (`createCheckout`, `verifySession`, `parseWebhook`) with a Stripe implementation |
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
| Client-specific components (`BrandsMarquee`, `WhatsAppButton`, hero content) | project layer |
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
│       ├── core/                 # auth, users, staff, profile, permissions, settings, notifications, newsletter, config, events, health, common/
│       ├── modules/
│       │   └── ecommerce/        # catalog/, orders/, payments/, loyalty/, analytics/, media/, ecommerce.module.ts
│       ├── infrastructure/       # prisma/, redis/, storage/, mail/, payments-providers/
│       ├── project/              # project config loader, project seed, project-specific providers
│       ├── app.module.ts         # composes core + enabled modules from project config
│       └── main.ts
│
├── backend/prisma/
│   ├── schema/                   # multi-file schema (Prisma ≥ 6.7): core.prisma, infrastructure.prisma, ecommerce.prisma, project.prisma
│   ├── migrations/               # single linear history (D11)
│   └── seed/                     # core seed (settings, owner) + per-module + project seeds
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
| D4 | Role model | Generic string-based roles; capabilities registered by modules; `UserRole` enum retired |
| D5 | Content / localization | UI strings per layer via `@nuxtjs/i18n`; content localization is module-owned (e-commerce keeps column-per-locale in v1) |
| D6 | Tenancy | Single tenant per independent project |
| D7 | Provider abstraction | Interfaces/adapters only for storage, mail, payments; Prisma and Redis used directly |
| D8 | Event mechanism | Lightweight in-process event bus (`@nestjs/event-emitter` or equivalent); no queue |
| D9 | API contract | `useApi` is the single client; wire types live in a shared contracts location; snake_case over the wire stays |
| D10 | Configuration ownership | Core config + module config fragments + project config; env holds secrets only |
| D11 | Database / schema ownership | Multi-file Prisma schema per layer/module; single linear migration history |
| D12 | Enforcement | Typecheck, lint, unit tests, boundary checks on every pull request |

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

**The Core `User` model must not own module-specific fields.** Specifically not: `loyaltyPoints`, orders, carts, wishlists/favourites, inventory data. Today `User.loyaltyPoints` violates this and is scheduled for extraction (§11, seam 2). Modules reference users by `userId` and declare their own relations in their own schema file; the back-relation that Prisma requires on `User` is declared in the module's schema file, not in `core.prisma`.

Core services never read module-specific columns. Today `users.service` selects `loyaltyPoints` in three places; that select is removed with seam 2.

---

## 7. Registry System

A registry is a plain, typed collection that **modules contribute to and Core reads**. It is the only sanctioned way for Core to learn that a module exists. Registries are populated at composition time (backend: module registration; frontend: Nuxt `app.config` layer merge), are read-only afterwards, and are never mutated at runtime.

The pattern already exists implicitly: `PermissionsGuard` reads `RequirePermissions` metadata; `profile.me()` forwards `permissions[]` to the client; `staff`, `notifications`, `analytics` own their own `/admin/*` controllers. v1 names and generalises this. No plugin framework, no discovery, no dynamic loading — arrays and existing framework configuration only.

### 7.1 Essential for v1

| Registry | Contributors | Consumers | Static / runtime | Duplicate IDs | Disabled module |
|---|---|---|---|---|---|
| **Module Registry** — `{ id, version, backendModule, nuxtLayer, envSchema, contributes: {…} }` | Each module (one entry) | `app.module.ts` composition, root `nuxt.config.ts` `extends`, config loader, docs generator | Static (project config lists enabled ids) | Build/boot error | Entry absent → nothing below is contributed |
| **Permission Registry** — capabilities `{ id: 'verb:noun', description }` and role presets `{ role, capabilities[] }` | Core (`owner`, `member`, `view:notifications`, `manage:media`, `manage:staff`, `manage:settings`, `view:users`), each module | `permissionsFor()`, `PermissionsGuard`, `profile.me()` → frontend `usePermissions` | Static | Boot error (two modules must not claim one capability id) | Its capabilities and role presets vanish; users holding a vanished role keep the string but resolve to no capabilities |
| **Admin Registry** — `{ id, path, capability, titleKey, subtitleKey, icon, order, group }` | Core (staff, users, newsletter, notifications, settings), each module | `layouts/admin.vue` nav and titles, `middleware/admin.ts` gating, landing-path resolution, dashboard widget list | Static (frontend `app.config` merge) | Build error | Sections absent; routes absent because the layer is not extended |
| **Settings Registry** — `{ key, type, default, public, group, labelKey, validation }` | Core (none required in v1), each module (e-commerce: shipping + loyalty keys), project (overrides of defaults) | `SettingsService` typed read, `GET /settings` (public keys only), admin settings page form, seed | Static definitions; runtime values in DB | Boot error | Keys absent from public read and admin form; existing rows stay in DB untouched |
| **Event Registry / Event Bus** — `const Events = { 'user.registered': UserRegisteredPayload, … }` + emitter | Core emits identity events (`user.registered`, `user.authenticated`, `user.password_reset`); modules emit domain events (`order.created`, `order.paid`, `product.stock_changed`) | Any module subscribes; Core subscribes to nothing from modules | Static names, runtime dispatch | Type-level (a name maps to one payload type) | No emitters, no subscribers |
| **Navigation slots** (minimal) — `navItems[]`, `headerActions[]`, `accountItems[]`, `globalWidgets[]` | Modules and project via `app.config` | `AppHeader`, `AppFooter`, `AccountSidebar`, `layouts/default.vue` | Static | Build error | Absent |

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
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Only when payments is enabled |
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

Target classification. Ownership is expressed by which schema file declares the model (D11).

| Owner | Models today | Target change |
|---|---|---|
| **Core** (`core.prisma`) | `User`, `Setting`, `NewsletterSubscriber`, `Notification` | `User` loses `loyaltyPoints`; `User.role` becomes `String`; `UserRole` enum retired (D4); `Notification` becomes `{ type String, key String?, meta Json, isRead, createdAt }` — `productId`, `stock` and the `NotificationType` enum leave |
| **Infrastructure** (`infrastructure.prisma`) | `ProcessedEvent` | `orderId` → generic `subjectId String?`; stays the webhook idempotency ledger |
| **E-commerce module** (`ecommerce.prisma`) | `Product`, `Category`, `Favourite`, `Order`, `OrderItem`, `LoyaltyTransaction`, enums `OrderStatus`, `FulfillmentType`, `PaymentMethod`, `PaymentStatus`, `LoyaltyType` | Adds `LoyaltyAccount { userId @unique, points }`; declares the `User` back-relations it needs (`orders`, `favourites`, `loyaltyTransactions`, `loyaltyAccount`) |
| **Dead** | `RefreshToken` | Remove in Phase 1. Nothing reads or writes it; refresh tokens live in Redis (`refresh:{userId}:{jti}`). Not removed in this step |

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
| **Module frontend (e-commerce)** | `stores/{cart,favourites,filters}`, `useProducts`, `useCurrency`, `components/{product,cart,checkout,filters,loyalty}`, `admin/ProductDrawer`, pages `products/*`, `checkout/*`, `brands`, `account/{orders,favourites,loyalty}`, admin `index` dashboard content, `analytics`, `products`, `categories`, `orders`; e-commerce wire types; e-commerce i18n namespaces; its `navItems`, `headerActions` (cart button), `globalWidgets` (`CartDrawer`), `accountItems`, `adminSections` |
| **Project frontend** | `pages/{index,about,contact}`, `BrandsMarquee`, `WhatsAppButton`, `brand.css` values, fonts, `project.config.ts`, project i18n namespaces (`home`, `hero`, `about`, `contact`, `testimonials`), any client-specific layouts or workflows |

### 10.2 Rules

1. **Global layouts and shells must not import optional-module features.** `layouts/default.vue` mounting `CartDrawer`, `AppHeader` importing `useCartStore`/`useFiltersStore`/`useState('cart-open')`, `AccountSidebar` and `account/index` hardcoding shop routes and `loyalty.*` keys are the current violations; they are replaced by slots and `app.config` lists (Phase 1–2).
2. **Module navigation is contributed through registries** (`navItems`, `headerActions`, `accountItems`, `globalWidgets`), never by editing a Core component.
3. **Module admin sections are contributed through the Admin Registry**; the layout, the middleware and the landing-path logic read it. The three hand-maintained copies (`layouts/admin.vue`, `usePermissions.SECTION_CAPS`, backend `permissions.ts`) collapse into one.
4. **`useApi` is the only standard HTTP entry point.** It owns `apiBase`, `credentials: 'include'`, and 401 → single-flight refresh → retry. Raw `$fetch`/`useFetch` against the API is allowed only in `useApi` itself and in the SSR auth plugin, with a comment stating why. Today 27 files read `apiBase` and every admin page calls `$fetch` directly; they migrate in Phase 1.
5. **`useApi` must not import or mutate Pinia stores.** It exposes an `onUnauthenticated` hook; the auth plugin registers the store reset. This breaks the current `useApi ↔ useAuthStore` cycle.
6. **Avoid flat component namespace collisions.** When layers are introduced, `components.pathPrefix: false` is replaced by a per-layer prefix (`Core*`, `Shop*`, `Project*`) or by `pathPrefix: true`. Silent last-wins overrides between layers are forbidden.
7. **Shared UI state by string key** (`useState('…')`) is owned by the layer that defines the key and is exposed through a composable; Core never reads a module's key.
8. Pages that require auth or admin declare it with `definePageMeta({ middleware })`; the SSR/CSR split of the guards is a Core decision and is not overridden per page.

### 10.3 Minimum frontend architecture for v1

Two layers (`core`, `ecommerce`) plus a `project` layer; `useApi` as the single client with the hook; `app.config`-merged lists for admin sections, nav items, header actions, account items, global widgets; per-layer component prefix; per-layer i18n files; `Profile` core type with module augmentation; `project.config.ts` feeding branding, locales and currency.

---

## 11. E-commerce Separation Plan

The ten seams, in the order they should be cut. Each leaves the system bootable. File references are current locations.

| # | Seam | Today | Target owner | Migration risk |
|---|---|---|---|---|
| 1 | **Remove guest-order linking from Core Auth** — **DONE** | Was `AuthService.linkGuestOrders()` over `order`, `loyaltyTransaction`, `user.loyaltyPoints`, `setting` on register/login/Google login | `backend/src/core/events/` (`CoreEventBus`, `user.authenticated`); `backend/src/orders/guest-order-linker.service.ts` subscribes; `backend/src/orders/loyalty.service.ts` awards points | Emit is awaited, so the user object returned by login still reflects the linked orders. Failure policy applies: a subscriber error is logged and login succeeds (previously it would have failed the request). Earn rate now read via `SettingsService.loadPricing()` like order creation |
| 2 | **Move loyalty ownership out of User** | `User.loyaltyPoints` column; selected in `users.service` (3×); written by `auth`, `orders`, `payments`; `GET /profile/loyalty` in Core | `LoyaltyAccount` table and `/loyalty/*` endpoints in the e-commerce `loyalty` sub-domain; profile payload extended through a Core `ProfileExtension` hook | Data migration with backfill; two-step (add table + dual-write, then drop column). Downstream live data must run the migration, never a cherry-pick alone |
| 3 | **Remove shop-specific roles from Core** | `UserRole` enum has `CUSTOMER`, `ACCOUNTANT`, `STOCK_MANAGER`; `permissions.ts` maps them; `staff.service` demotes to `CUSTOMER`; frontend `STAFF_ROLES` duplicated | `role String`; Core defines `owner`, `member`; e-commerce registers `accountant`, `stock_manager` with capability presets via the Permission Registry | Postgres enum → text migration (`USING role::text`); value casing (`admin` vs `ADMIN`) must be normalised once; highest-risk migration in v1 |
| 4 | **Move shop settings definitions into E-commerce** — **DONE (code)** | Was `SettingsService.PRICING_SETTING_KEYS`, `loadPricing()`, the duplicate admin allowlist, and the public `GET /settings` in Core | Core `SettingsService` is generic: `define(definitions)` (registry, duplicate key = boot error), `definitions()`, `getAll()` (cached), `invalidate()`, admin read/write with the registered keys as the allowlist (`settings/setting-definition.ts`). The orders module owns the pricing definitions (`orders/pricing-settings.ts`), the validated fail-loud `loadPricing()` (`orders/pricing-settings.service.ts`, registers on init) and the public `GET /settings` (`orders/pricing-settings.controller.ts`); `orders`, `loyalty` and `payments` read through it (payments no longer has a silent `100` fallback) | **Residue:** `prisma/seed.ts` still hard-codes the five pricing keys — stays until the Phase 3 registry-driven seed; the frontend admin settings form still hard-codes the five keys — stays until the Phase 2 registry-driven form. `/settings` and `/admin/settings` contracts unchanged |
| 5 | **Separate generic email/notification mechanisms from shop templates** — **DONE (code)** | Was `MailService.sendOrderConfirmation`; `NotificationsService.checkStock`, `LOW_STOCK_THRESHOLD`, `StockProduct` | Mail: `MailService` keeps transport, `renderLayout()`, `buttonStyle()`, `brand` and a generic `sendMail(message, label)` with the same catch-and-log semantics; the order template lives in `orders/order-confirmation.mail.ts`. Notifications: `NotificationsService` keeps only domain-free primitives (`findOpen`, `create`, `update`, `resolveOpen`) plus the inbox; the stock rule lives in `products/stock-alerts.service.ts`, used by products and orders | **Residue (schema/capability step, not code):** the inbox controller is still guarded by `manage:inventory` (should become `view:notifications`), the `NotificationType` enum still has only `LOW_STOCK`/`OUT_OF_STOCK`, and `Notification.productId`/`stock` are still product-shaped columns rather than `key`/`meta`. These change together with the multi-file schema; the boundary baseline tracks the capability |
| 6 | **Move Stripe business logic behind Payments** | `payments.service` instantiates the SDK, builds line items, creates coupons, handles the webhook; `main.ts` sets `rawBody: true` for it | `PaymentProvider` interface in Infrastructure with a Stripe implementation; e-commerce `payments` sub-domain orchestrates orders; `rawBody` documented as a payments requirement | Medium. Idempotency keys and the `ProcessedEvent` transaction pattern must survive unchanged |
| 7 | **Move MinIO/storage logic behind Storage/Media** | `MinioService` used directly by `products`, `favourites`, `orders`, `admin`, `uploads`; four copies of "presign first image"; `isExternalUrl` duplicated | `StorageAdapter` (`put`, `resolve(refs[])`, `presign`) in Infrastructure; `media` sub-domain owns the upload endpoint and validation; callers call `resolve` once | Medium. `Product.images` semantics (object keys) are unchanged; only the resolution path centralises |
| 8 | **Separate shop cache namespaces** | `admin.service` deletes `products:*`, `categories:tree`; `orders.service` deletes `analytics:*` by string | Each owner exposes `invalidate()`; callers call it. Namespace convention `<module>:<entity>:<id>:<field>` documented | Low. Until the e-commerce module splits internally this is hygiene; it becomes a boundary rule when it does |
| 9 | **Remove shop dependencies from global frontend layouts** | `layouts/default.vue` → `CartDrawer`; `AppHeader` → cart/filters stores + `cart-open` state + hardcoded shop nav; `AccountSidebar` + `account/index` → shop routes and keys | Slots and `app.config` lists (§10.2 rules 1–3) | Low code risk; visual regression risk — verify header, account dashboard and admin nav render identically with the e-commerce layer enabled |
| 10 | **Split the God Admin service** — **DONE** | Was `backend/src/admin/admin.service.ts` (515 lines) | Newsletter → `newsletter`, settings → `settings`, customers → `users`, orders → `orders`, categories → `categories` (+ DTO), products → `products` (+ DTO), stats → `analytics`; each with its own `admin/*` controller. `admin/` folder removed | Done in seven verbatim moves + one deletion; route inventory (57 routes, guards, capabilities) identical before and after every step. Route paths kept (`/admin/customers` not renamed) |

Dead code removed alongside (no seam, just deletion in Phase 1): `RefreshToken` model, `AdminGuard`, `plugins/stripe.client.ts` `$stripe` provide, root `stripe`/`resend`/`zod` dependencies, `runtimeConfig` secret keys in `nuxt.config.ts`, `app/types/database.types.ts`, `pages/confirm.vue`, `pages/admin/products/[id].vue`, `app/package.json`, stale `.nuxt` folders.

---

## 12. Architecture Enforcement

> **Architecture rules are not complete until they are enforceable automatically.**

### 12.1 Verification workflow (implemented)

Backend: `npm run verify` (in `backend/`), also run by `.github/workflows/verify.yml` on every pull request and push to `main`. Its purpose is to make every seam cut in §11 mechanically checkable, so a later change cannot silently reopen it. The stages run **in this order** and the chain stops at the first failure:

| # | Stage | Command | Why this position |
|---|---|---|---|
| 1 | Typecheck | `npm run typecheck` (`tsc --noEmit`) | cheapest signal; fails before anything is built |
| 2 | Build | `npm run build` (`nest build` → `dist/`) | stages 4–5 compose the application from `dist/` |
| 3 | Boundary verification | `npm run verify:boundaries` | source-tree rules ([DEPENDENCY-RULES.md](DEPENDENCY-RULES.md) §10) with a baseline of known, seam-tracked violations; needs no build but runs after it so a broken build never masks a boundary error |
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
| Schema check | — | `prisma migrate diff` empty after the multi-file split; migrations linear |
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

- Remove dead code (list in §11).
- Add the event bus (D8) — prerequisite for the next item.
- Remove shop logic from Auth (seam 1).
- Remove shop-specific roles from Core (seam 3) — includes the enum migration.
- Make optional providers optional — **DONE (backend)**: `core/config/env.validation.ts` holds the core schema plus conditional provider fragments; MinIO client, Stripe client, Resend transport and Google strategy are instantiated only when configured and fail with 503 when used unconfigured; `rawBody` documented in `main.ts`. Still open: Nginx `/media/` block is unconditional (Docker config, separate step); frontend still renders the Google button regardless.
- Split the admin God Service (seam 10) — **DONE**.
- Separate the Core settings mechanism (seam 4) — **DONE (code)**; residue = `prisma/seed.ts` hard-codes the five pricing keys (Phase 3 registry-driven seed) and the frontend admin settings form hard-codes them (Phase 2 registry-driven form).
- Separate mail/notification mechanisms from shop templates (seam 5) — **DONE (code)**; residue = `manage:inventory` on the inbox, `NotificationType` enum, `Notification.productId`/`stock` columns, all deferred to the schema step.
- Remove global frontend shop coupling (seam 9) using slots first; registries follow in Phase 2.
- Fix the `useApi ↔ useAuthStore` cycle — **DONE** (`api:unauthenticated` Nuxt hook + `plugins/auth-hooks.ts`); migrate raw `$fetch` calls to `useApi` — open.
- Introduce backend folder layers (`core/`, `modules/ecommerce/`, `infrastructure/`) and the multi-file Prisma schema; verify empty migration diff.

### Phase 2 — Registries and Module Boundaries

- Module Registry and enabled-modules composition in `app.module.ts` / root `nuxt.config.ts`.
- Permission Registry (capabilities + role presets); frontend reads from `/profile` only.
- Admin Registry; `layouts/admin.vue`, `middleware/admin.ts`, landing path read it.
- Settings Registry; admin settings page renders from it; seed iterates it.
- Event Registry (typed names) on top of the Phase 1 bus.
- Module-driven frontend navigation (`navItems`, `headerActions`, `accountItems`, `globalWidgets`).
- Nuxt layers: `app/core`, `app/modules/ecommerce`; component prefixing; per-layer i18n.
- Loyalty extraction (seam 2), storage adapter (seam 7), payments provider surface (seam 6), cache namespace hygiene (seam 8).

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
| **Role enum migration** breaks a live database (downstream PetShopCY has real rows) | Seam 3 | Two-step migration; explicit value mapping; "schema-owning commits are never cherry-picked alone" rule; rehearse on a DB copy |
| **Localization schema migration** — a future JSON-column or translations-table move for `Product`/`Category` touches every consumer (25 inline `locale === 'el'` ternaries today) | D5 | v1 keeps column-per-locale inside e-commerce; introduce a `useLocalized()` helper first so the eventual change is one place |
| **Prisma schema ownership** — multi-file split creates an accidental diff or breaks `prisma generate` | Phase 1 | `prisma migrate diff` gate; split in its own commit |
| **Frontend flat namespace** — layer components silently override each other | Phase 2 | Prefix rule before the first layer is created; build fails on duplicate names |
| **Cache invalidation coupling** — string-keyed cross-module deletes survive the split | Seam 8 | Per-module `invalidate()`; grep-based check for `delPattern('` outside the owning module |
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
