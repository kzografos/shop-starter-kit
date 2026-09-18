# Module Registry

Inventory of the application's modules, the dependency rules between them, what the source tree actually does today, and what is ready for the Nuxt-layer / backend-folder extraction that follows. State as of `451ae51` (after the Admin Registry, Settings Registry and `useApi` milestones). Documentation only — no runtime code changed.

Sources: the source tree itself (a folder-level import graph of `backend/src`, a per-file usage map of `app/` — composables, stores, components, `useState` keys, i18n namespaces, Prisma model access), `backend/scripts/verify-boundaries.js` (the enforced layer map), and the documents [ARCHITECTURE-AUDIT.md](ARCHITECTURE-AUDIT.md), [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md), [ARCHITECTURE-CHECKLIST.md](ARCHITECTURE-CHECKLIST.md), [ARCHITECTURE-BLUEPRINT.md](ARCHITECTURE-BLUEPRINT.md), [USEAPI-MIGRATION.md](USEAPI-MIGRATION.md). (`DEPENDENCY-AUDIT.md` and `READINESS-CHECK.md` do not exist in the repository; `DEPENDENCY-RULES.md` and `ARCHITECTURE-CHECKLIST.md` are the closest and were used.)

Layers, as the blueprint defines them and the boundary script enforces them: **INFRASTRUCTURE** → **CORE** → **SHOP** (the e-commerce module and its sub-domains) → **PROJECT**. "Admin" and "Auth" are not layers: Auth is a Core module; Admin is a Core shell (layout, middleware, registries) that Core and Shop modules both contribute sections to.

---

## 1. Module inventory

### 1.1 Backend — Infrastructure (`backend/src/…`)

| Module | Path | Responsibility | Public entry points | Depends on | Consumers |
|---|---|---|---|---|---|
| prisma | `prisma/` | Prisma client as a Nest provider (global) | `PrismaService` | — | every module with a table |
| redis | `redis/` | ioredis client; `get/set(ttl)/del/exists/delPattern/ping`, fail-soft (global) | `RedisService` | — | auth (tokens), settings, products, categories, analytics, notifications, health |
| storage | `storage/` | `StorageAdapter` contract (`isEnabled/put/resolve/presign/remove`) + `MinioStorageAdapter` (global; disabled when unconfigured) | `StorageAdapter` | core/config (`isStorageConfigured`) | uploads, products, favourites, orders |
| payments-provider | `payments-provider/` | `PaymentProvider` contract (`createCheckout/getCheckoutStatus/parseWebhook`) + `StripePaymentProvider` (global; 503 when unconfigured) | `PaymentProvider` | core/config | payments |
| mail | `mail/` | SMTP/Resend transport, branded layout, generic `sendMail`, reset/welcome templates (global; disabled-safe) | `MailService` | core/config | auth, newsletter, orders, payments |
| health | `health/` | `GET /health` (Postgres + Redis), `RedisHealthIndicator` | route | prisma, redis | Docker healthcheck, Nginx |
| common | `common/` | `GlobalExceptionFilter` (Prisma error mapping), `SnakeCaseInterceptor`, `serialize` util | classes | — | main.ts, products |

### 1.2 Backend — Core

| Module | Path | Responsibility | Public entry points | Depends on | Consumers |
|---|---|---|---|---|---|
| core/events | `core/events/` | `CoreEventBus` (typed, awaited, log-and-continue), `user.authenticated` (global) | `CoreEventBus`, `CoreEventMap` | — | auth (emits), orders (subscribes) |
| core/config | `core/config/` | Joi env contract; `isStorageConfigured/isPaymentsConfigured/isGoogleAuthConfigured/isMailConfigured` | `envValidationSchema`, helpers | — | app.module, storage, payments-provider, mail, auth (google) |
| auth | `auth/` | Register/login/logout/refresh (Redis-rotated), Google OAuth, password reset; `JwtAuthGuard`, `OptionalJwtAuthGuard`, `PermissionsGuard`, `RequirePermissions`, `CurrentUser`; **Permission Registry** (`PermissionsRegistryService`, global) with Core capabilities/roles in `permissions.ts` | routes `/auth/*`; guards/decorators; `PermissionsRegistryService`; `OWNER_ROLE/MEMBER_ROLE` | users, redis, mail, core/events, core/config | every guarded controller; profile, staff, users, analytics (constants); all modules that register capabilities |
| users | `users/` | `User` rows (create/find/link Google/password/profile), customer list; **User-extensions registry** | `UsersService`, `UserExtensionsRegistry`; `GET /admin/customers` | prisma, auth (guards, `MEMBER_ROLE`) | auth, profile, staff, loyalty, orders |
| profile | `profile/` | `GET/PATCH /profile` with `permissions[]` and extension fields | routes | users, auth | frontend session |
| staff | `staff/` | Staff CRUD (roles from the registry), last-owner guard | `/admin/staff/*` | prisma, auth | admin |
| settings | `settings/` | **Settings Registry**: definitions/groups, defaults-on-read, validated admin writes, public subset | `SettingsService`; `GET /settings`; `GET/PATCH /admin/settings` | prisma, redis, auth | orders (pricing), admin form, storefront |
| notifications | `notifications/` | `Notification` rows: staff inbox (`userId null`) + per-user feed; idempotent `create`, tx-joinable `createWrite`; unread caches | `NotificationsService`; `/admin/notifications/*`; `/notifications/*` | prisma, redis, auth | products (stock alerts), orders (status), admin + customer UIs |
| newsletter | `newsletter/` | Subscribe, tokened unsubscribe (HMAC), admin list | `/newsletter/*`, `/admin/newsletter` | prisma, mail, auth | footer, admin |
| uploads | `uploads/` | `POST /uploads/image` (5 MB, magic bytes, `manage:media`) | `UploadsService` | storage, auth | products (image sub-resource) |

### 1.3 Backend — Shop (the e-commerce module; one module, seven sub-domains)

| Sub-domain | Path | Responsibility | Public entry points | Depends on | Consumers |
|---|---|---|---|---|---|
| products (catalog) | `products/` | Catalogue queries/caching, admin CRUD, image sub-resource, `StockAlertsService`, `CatalogPermissions` | `ProductsService`, `StockAlertsService`; `/products*`, `/admin/products*` | prisma, redis, storage, uploads, notifications, auth, common | categories, orders, favourites |
| categories (catalog) | `categories/` | Tree + admin CRUD; invalidates through the products owner | `CategoriesService`; `/categories`, `/admin/categories*` | products, prisma, redis, auth | storefront, admin |
| favourites | `favourites/` | Per-user favourites | `/favourites*` | prisma, storage, auth | account |
| orders | `orders/` | Order creation (idempotent), lifecycle (`order-status.ts`), cancel/restock, customer + admin routes, `PricingSettingsService` (+ definitions), `GuestOrderLinkerService`, `OrderNotificationsService`, `OrdersPermissions` (+ shop role presets), `OrdersUserExtension`, order mail template | `OrdersService`, `PricingSettingsService`, `OrderNotificationsService`; `/orders*`, `/admin/orders*` | products, settings, users, loyalty, analytics, notifications, mail, storage, core/events, auth | payments |
| payments | `payments/` | Checkout session orchestration, webhook settlement with `ProcessedEvent` ledger, expiry release | `/payments/*` | orders, loyalty, payments-provider, mail, prisma, auth | Stripe webhooks, checkout |
| loyalty | `loyalty/` | `LoyaltyAccount` + ledger (only writer), earn/redeem/reverse, `LoyaltyUserExtension` | `LoyaltyService`; `GET /profile/loyalty` | prisma, users, auth | orders, payments |
| analytics | `analytics/` | Overview + dashboard stats (5-min cache), `AnalyticsPermissions` | `AnalyticsService`; `/admin/analytics`, `/admin/stats` | prisma, redis, auth | orders (invalidate), admin dashboard |

Root: `app.module.ts`, `main.ts` — composition root, may import everything. `prisma/*.prisma` follows the same split (`core`, `infrastructure`, `ecommerce`).

### 1.4 Frontend — Core (`app/…`)

| Module | Path | Responsibility | Public entry points | Depends on | Consumers |
|---|---|---|---|---|---|
| api client | `composables/useApi.ts` | Single HTTP door: base URL, cookies, 401 → single-flight refresh → retry, `api:unauthenticated` hook | `useApi()` | runtime config, Nuxt hooks | everything that talks to the backend |
| session | `stores/auth.ts`, `plugins/auth.{client,server}.ts`, `plugins/auth-hooks.ts`, `middleware/{auth,guest,admin}.ts` | Profile state, SSR bootstrap, sign-out, route guards | `useAuthStore`, middlewares | useApi, usePermissions | shells, pages |
| permissions | `composables/usePermissions.ts` | `can()`, `isStaff`, admin-registry-backed `requiredCapFor/firstAllowedPath` | `usePermissions()` | auth store, admin-registry utils | admin shell, middleware, header |
| admin shell | `layouts/admin.vue`, `composables/useAdminRegistry.ts`, `utils/admin-registry.ts`, `components/admin/{AdminIcon,AdminInfo,DateRangeControl}.vue`, `assets/css/admin.css` | **Admin Registry** consumer: sidebar, titles, gating; `.ac-*` primitives | layout `admin`, `useAdminRegistry()` | app.config, permissions, useAdminNotifications | admin pages (Core and Shop) |
| storefront shell | `layouts/default.vue`, `components/layout/{AppHeader,AppFooter,WhatsAppButton}.vue`, `components/Brand*.vue` | Header/footer/widgets from `app.config` contribution lists | layout `default` | app.config, auth store, permissions, useApi (newsletter) | every storefront page |
| account shell | `components/account/AccountSidebar.vue`, `pages/account/index.vue` | Account nav from `accountItems`, dashboard from `accountCards` | — | app.config, auth store | account pages |
| notifications (customer) | `composables/useCustomerNotifications.ts`, `components/notifications/NotificationBell.global.vue`, `pages/account/notifications.vue` | Feed state, bell, history page | `useCustomerNotifications()` | useApi, auth store | header (via `headerActions`), account |
| notifications (staff) | `composables/useAdminNotifications.ts`, `pages/admin/notifications/index.vue` | Unread badge state, inbox page | `useAdminNotifications()` | useApi | admin shell |
| Core admin pages | `pages/admin/{customers,newsletter,staff,settings}/index.vue` | Registry-driven settings form (`utils/settings-form.ts`), staff, customers, newsletter | — | useApi, i18n `admin.*` | — |
| auth pages | `pages/{login,forgot-password,reset-password,unsubscribe}.vue`, `pages/auth/callback.vue`, `composables/useAuthInputClass.ts` | Sign-in/reset/unsubscribe flows | — | useApi, auth store | — |
| contracts | `types/index.ts` (repo root), `app/types/contributions.ts` | Wire types; contribution contracts (nav, header, widgets, account, admin sections/groups) | types | — | both halves |
| i18n | `i18n/{el,en}.json` | All namespaces for both locales (496+ keys each) | `$t` | — | everything |

### 1.5 Frontend — Shop

| Module | Path | Responsibility | Depends on |
|---|---|---|---|
| catalogue | `pages/products/{index,[slug]}.vue`, `pages/brands.vue`, `components/product/*`, `components/filters/*`, `composables/useProducts.ts`, `stores/filters.ts` | Listing, filters, detail, brands | useApi, filters store, cart/favourites stores, `useCurrency` |
| cart & checkout | `stores/cart.ts`, `components/cart/*`, `composables/useCartDrawer.ts`, `pages/checkout/*`, `components/checkout/*` | Cart (persisted), drawer, checkout, Stripe redirect, guest CTA | useApi (`/settings`, `/orders`, `/payments/*`), auth store |
| orders (customer) | `pages/account/orders/*`, `composables/useOrderPresentation.ts` | History, detail with lifecycle, self-cancel, repeat | useApi, cart store |
| favourites | `stores/favourites.ts`, `pages/account/favourites.vue` | Toggle/list | useApi, auth store |
| loyalty | `components/loyalty/*`, `pages/account/loyalty.vue`, `components/account/AccountStats.global.vue` | Balance card/badge, history, dashboard stats | auth store (`loyaltyPoints`), favourites store, useApi |
| shop admin pages | `pages/admin/{index,analytics,products,categories,orders}/index.vue`, `components/admin/ProductDrawer.vue` | Dashboard, analytics, catalogue CRUD + images, orders | useApi, admin shell primitives |
| contributions | shop entries in `app/app.config.ts` (`navItems`, `headerActions`, `globalWidgets`, `accountItems`, `accountCards`, `adminSections`) | Declares what the shells render | contracts |

### 1.6 Project layer

`app/utils/business.ts` (identity, address, hours, social), `assets/css/brand.css`, `app/app.config.ts` (the merged contribution lists until layers exist), `pages/{index,about,contact}.vue`, `components/BrandsMarquee.vue`, `composables/{useBusinessSchema,useOpeningHours}.ts`, `nuxt.config.ts` (locales), `PETSHOPCY-MANUAL.md`.

### 1.7 Shared

`backend/src/common/` (filter, interceptor, serialize) and `types/index.ts` are the only cross-cutting shared code. See finding F7 on the latter.

---

## 2. Dependency rules

Direction is downward only: `PROJECT → SHOP → CORE → INFRASTRUCTURE`. What is enforced and how:

| # | Rule | Enforced by | Status |
|---|---|---|---|
| R1 | Core and Infrastructure never import a Shop folder | `verify-boundaries` rule A (CI) | **Satisfied** — 0 findings |
| R2 | Core controllers never require a Shop capability | rule C | **Satisfied** |
| R3 | Core services never touch a Shop Prisma model | rule D | **Satisfied** |
| R4 | Services never import controllers | rule B | **Satisfied** |
| R5 | Infrastructure contains no business logic (adapters expose neutral contracts: `WebhookEvent`, `StorageAdapter`, `sendMail`) | review | **Satisfied** — Stripe line-shaping, order checks and mail templates live in `payments`/`orders` |
| R6 | Infrastructure imports nothing above it | blueprint §5; **not** in the script | **Not satisfied** — see F1 |
| R7 | Shop talks to Core through exported services, events and registries, never Core Prisma rows | AGENTS.md database rules; **not** in the script | **Partially satisfied** — see F2 |
| R8 | Shop sub-domains write only their own rows | MODULE-DEVELOPMENT-GUIDE | **Satisfied with one documented exception** — see F3 |
| R9 | Auth dependencies are explicit: guards/decorators imported from `auth/`, capabilities registered through `PermissionsRegistryService`, roles never hard-coded outside `auth/permissions.ts` (Core) and the registering module | review; `verify-routes` snapshot pins every route's guards + capabilities | **Satisfied**; folder cycle noted in F4 |
| R10 | Frontend shells (`layouts/*`, `AppHeader`, `AppFooter`, `AccountSidebar`, `account/index`, `layouts/admin`) import no Shop component/store/composable/state key/i18n key; they render `app.config` lists | review (no ESLint rule yet) | **Mostly satisfied** — `AppFooter` residue, see F5 |
| R11 | All HTTP through `useApi()`; raw `$fetch` only with `// raw-fetch:` | review; documented in USEAPI-MIGRATION | **Satisfied** (one justified exception) |
| R12 | `useState` keys namespaced and wrapped in a composable; Core never reads a Shop key | review | **Satisfied** (`cart-open` via `useCartDrawer`, `customer-notif-*`, `admin-notif-unread` via composables; the admin shell reads badge keys only by the name a registry entry gives it) |
| R13 | Admin-only code does not leak into storefront bundles | Nuxt route-level code splitting; admin pages/components live under `pages/admin` + `components/admin` and are only imported there | **Satisfied** — `usePermissions`/`isStaff` in the header is a Core visibility check, not admin code |
| R14 | Shared code stays small and layer-neutral | review | **Satisfied for `common/`; not for `types/index.ts`** — see F7 |

No rule above contradicts the running architecture; the three not fully satisfied are recorded as findings, not claimed as enforced.

---

## 3. Boundary findings

### 3.1 Clean boundaries (confirmed)

- Backend Core ↔ Shop: zero imports, zero capability leaks, zero model leaks (script + manual graph).
- Every cross-module backend dependency is a Nest module import of an exported service, an event subscription, or a registry contribution (`PermissionsRegistryService`, `SettingsService.define`, `UserExtensionsRegistry`).
- Adapters (`storage`, `payments-provider`, `mail`) each have one contract, one implementation, no domain knowledge.
- Frontend admin shell and permissions know no section, path or capability (Admin Registry); settings form knows no key (Settings Registry); HTTP goes through one client.
- Shared state keys are all behind composables.

### 3.2 Confirmed violations and risks

| # | Finding | Where | Severity | Type |
|---|---|---|---|---|
| F1 | **Infrastructure imports Core**: `storage/`, `payments-provider/`, `mail/` import `core/config/env.validation.ts` for the `isXConfigured()` helpers (`auth/` uses the same helper for Google, which is Core → Core and fine). The layer map puts `core/` in CORE; the blueprint forbids INFRA → CORE; the script does not check it. | `storage/storage.module.ts`, `payments-provider/stripe.provider.ts`, `mail/mail.service.ts` → `core/config/env.validation.ts` | Low (config helpers, no behaviour) | violation of R6 |
| F2 | **Shop reads Core rows directly**: `analytics.service` counts `user` rows (with `MEMBER_ROLE` from `auth/permissions`); `orders.service.create` does `prisma.user.findUniqueOrThrow` to check the buyer exists. Both bypass `UsersService`. | `analytics/analytics.service.ts:257-299`, `orders/orders.service.ts:106` | Low (reads only) | violation of R7 |
| F3 | **Cross-sub-domain write inside the shop**: `payments.service` updates `order` rows (session id; CONFIRMED/PAID inside the `ProcessedEvent` transaction). Accepted design: the settlement must be one transaction with the ledger row and `OrdersService` has no such primitive. | `payments/payments.service.ts:74,140` | Info | documented exception to R8 |
| F4 | **Folder-level cycle `auth ↔ users`**: `auth.service` → `users.service`; `users.service` → `auth/permissions` (`MEMBER_ROLE`); `users-admin.controller` → `auth/guards`. No Nest-module cycle (guards and the registry are global providers), but the two folders cannot be extracted separately. Same pattern: `staff`, `profile` → `auth/permissions`. | `users/users.service.ts:4`, `users/users-admin.controller.ts`, `auth/auth.service.ts` | Low | risky pattern |
| F5 | **Storefront shell residue**: `AppFooter.vue` hard-codes shop links `/products` and `/account/orders` (with `nav.products`, `account.orders`); `HeaderSearch.global.vue` (shop) reads the Core key `header.search_placeholder`. | `components/layout/AppFooter.vue:52,61`, `components/filters/HeaderSearch.global.vue:6` | Low | violation of R10 (documented seam-9 residue) |
| F6 | **Core store carries a shop field**: `stores/auth.ts` exposes `loyaltyPoints` (from the `loyalty_points` user extension). Five shop files and the checkout read it from the Core store instead of from `profile.loyalty_points` through a shop composable. | `stores/auth.ts:40`, `components/loyalty/*`, `components/account/AccountStats.global.vue`, `pages/account/loyalty.vue`, `pages/checkout/index.vue` | Low | Core → Shop knowledge |
| F7 | **Shared contracts file mixes layers**: `types/index.ts` holds Core (`Profile`, `Notification*`, `Setting*`) and Shop (`Product`, `Category`, `Order*`, `PricingSettings` in checkout) types in one file; `i18n/{el,en}.json` hold every namespace; `app/app.config.ts` holds Core and Shop contributions (by design until layers). | `types/index.ts`, `i18n/*.json`, `app/app.config.ts` | Medium for extraction, none at runtime | too-broad shared module |
| F8 | **Shop files in Core folders** (placement only): `components/account/AccountStats.global.vue`, `components/admin/ProductDrawer.vue`, `pages/account/{orders,loyalty,favourites}`, `pages/admin/{index,analytics,products,categories,orders}`, `pages/products`, `pages/checkout`, `pages/brands.vue`, `components/{cart,checkout,filters,loyalty,product}`, `stores/{cart,favourites,filters}`, `composables/{useProducts,useCartDrawer,useOrderPresentation,useCurrency}`. | frontend tree | Info | expected until layers |
| F9 | **Order-status wording in a Core composable**: `useCustomerNotifications.describe()` phrases `order_status` rows. Documented deferral (presenter registry when a second type appears). | `composables/useCustomerNotifications.ts` | Low | Core → Shop knowledge |
| F10 | **Shop role presets registered from `orders/`**: `orders-permissions.ts` registers `accountant`/`stock_manager` because the shop has no single root module yet. | `orders/orders-permissions.ts` | Info | documented interim |
| F11 | **Layer map is a script constant**: the only machine-readable registry is the `INFRA/CORE/SHOP` arrays in `verify-boundaries.js`; a new folder fails the gate as "unmapped" (good) but there is no registry entry format for modules yet. | `backend/scripts/verify-boundaries.js:32-34` | Info | tooling |

Differences from [ARCHITECTURE-AUDIT.md](ARCHITECTURE-AUDIT.md) (2026-09-18): the admin-shell coupling, hard-coded settings form, `usePermissions` section map and raw `$fetch` findings are **closed**; F1, F2, F4 and F6 are **new** (found by the import/model graph, not reported before); F5, F7, F9, F10 were known and are unchanged.

### 3.3 Recommendations (not done here)

- F1: at backend extraction, move `core/config/env.validation.ts` to `infrastructure/config/` (it is the adapters' configuration contract), or split the presence helpers next to each adapter; add an INFRA → CORE check to `verify-boundaries`.
- F2: add `UsersService.countCustomers()` / `exists()` and use them; extend rule D's spirit with a "Shop services touching Core models" check (`user`, `setting`, `notification`, `newsletterSubscriber`).
- F4: move `permissions.ts` constants and the guards/decorators into a `core/auth-contracts` (or `auth/contracts`) folder that `users`/`staff`/`profile` import, leaving `auth/` free to import `users/`.
- F5: `AppFooter` gets footer contribution lists (`footerLinks[]`) like the header; `HeaderSearch` gets its own key.
- F6: a `useLoyalty()` shop composable reading `profile.loyalty_points`; drop `loyaltyPoints` from the Core store.
- F7: with layers, split `types/index.ts` into `types/core.ts` + `types/shop.ts` (or per layer), and i18n into per-layer files (Nuxt i18n merges).
- F11: when the layer split lands, replace the script arrays with a `modules.registry.ts` (id, layer, backend folder, Nuxt layer path, contributions) that the script and docs both read.

---

## 4. Extraction readiness

Target (blueprint §13 Phase 2): backend `core/`, `modules/ecommerce/`, `infrastructure/`; Nuxt layers `app/core`, `app/modules/ecommerce`, later `app/project`.

### Ready for extraction (move as-is, contracts unchanged)

- **Backend Infrastructure**: `prisma`, `redis`, `storage`, `payments-provider`, `mail`, `health`, `common` — after F1 (config file placement).
- **Backend Shop sub-domains**: `products`, `categories`, `favourites`, `orders`, `payments`, `loyalty`, `analytics` — self-contained, registry-driven; F2 is a two-method change; `orders-permissions.ts` presets move to the new `ecommerce.module.ts` root.
- **Frontend Shop**: catalogue, cart/checkout, customer orders, favourites, loyalty components/pages, shop admin pages, `ProductDrawer`, the shop entries of `app.config.ts` — all consume Core only through `useApi`, the auth store, `usePermissions`, registries and shell slots. Component prefixing (`Shop*`) is required at move time (blueprint §10).
- **Frontend Core**: shells, session, permissions, admin shell, notifications, Core admin pages, auth pages.

### Require refactoring first

- `auth` ↔ `users` folder cycle (F4) before either becomes a separately extractable Core package (they can move together as Core without change).
- `AppFooter` (F5) and the `loyaltyPoints` store field (F6) before the shells can be declared Shop-free.
- `types/index.ts`, `i18n/*.json`, `app.config.ts` (F7) must be split at extraction time — mechanical but every consumer's import path changes.
- `useCustomerNotifications.describe()` (F9) if order-status rendering is to live in the shop layer.

### Must remain application-specific for now

- Project layer: `utils/business.ts`, `brand.css`, `pages/{index,about,contact}.vue`, `BrandsMarquee`, `nuxt.config.ts` locales, `prisma/seed.ts` owner bootstrap — Phase 3 (`project.config.ts`) work, not layer work.
- `app.module.ts` / `main.ts` composition roots and the boundary script's layer map (F11) until the Module Registry gains a code representation.
- `backend/scripts/verify-*.js` — tooling stays at the repo level.

---

## 5. How to keep this registry true

- A new backend folder must be added to the layer map in `verify-boundaries.js` (the gate refuses unmapped folders) **and** to §1 here.
- A new frontend module lists its shell contributions in `app.config.ts` and its pages/components/stores in §1.5 (or, after extraction, its layer's own README).
- Findings in §3.2 are closed by editing this file in the same commit that removes them.
