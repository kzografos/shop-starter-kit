# Extraction Readiness Audit — Core vs. Shop

Date: 2026-09-18 · Branch: `phase-1-clean-ground` · Kind: analysis, inventory and plan. **No runtime change, no move, no migration.**

Source of truth for the milestone "Extraction Readiness Audit". Numbers come from `backend/scripts/audit-extraction-readiness.js` run on this commit (§14); ownership judgements come from reading the files, not from folder names. Where a file was not read, the tables say so.

Related: [MODULE-REGISTRY.md](MODULE-REGISTRY.md) (module inventory, findings F1–F11, §3.4 pre-extraction cleanup), [EVENT-REGISTRY.md](EVENT-REGISTRY.md) (events, side effects, R1–R11 / B1–B8), [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md), [ARCHITECTURE-BLUEPRINT.md](ARCHITECTURE-BLUEPRINT.md) §2/§9/§13, [MODULE-DEVELOPMENT-GUIDE.md](MODULE-DEVELOPMENT-GUIDE.md).

---

## 1. Executive summary

- **The backend is extraction-ready as three packages** (Infrastructure, Core, Shop/e-commerce). ~~One cleanup first: three Infrastructure adapters import `core/config/env.validation.ts` for `isXConfigured()` helpers (F1).~~ **F1 closed (same day, §8):** each provider owns its presence check; backend forbidden edges are now **0**. Zero Core→Shop code edges, zero Core→Shop Prisma access, zero file-level cycles. The `auth↔users` folder cycle is the guard/decorator contract only and does not stop Core moving as one package.
- **The frontend Shop is extraction-ready as a Nuxt layer.** 40 shop files consume Core only through the documented surface (`useApi`, `useAuthStore`, `usePermissions`, `AccountSidebar`, admin shell, presenter registry) — 38 Shop→Core edges, all to that surface. Zero Core→Shop code edges; the 5 Core→Shop *registry* references are `app.config.ts` contributions, which is the intended composition and move with the project layer.
- **The frontend Core is not yet brand-free.** 12 Core→Project edges: shells, auth pages and `app.vue` hard-code `BrandLockup`, `WhatsAppButton`, `utils/business.ts` and `useBusinessSchema`. This is the real blocker for a reusable Core layer (blueprint `project.config.ts`, roadmap C3), not a Core↔Shop problem.
- **Shared resources**: `types/index.ts` and `i18n/*.json` are mixed but mechanically splittable; `app.config.ts` is project-owned by design. The only semantic leaks in them were removed in the pre-extraction cleanup.
- **Recommended first slice**: backend Infrastructure package (F1 is done, so it is a pure move) **or** frontend Shop layer — both are low-risk and reversible; the doc recommends the backend Infrastructure move because it proves the move mechanics with the smallest blast radius. Full order in §11.

---

## 2. Audit scope and methodology

**In scope**: `backend/src/**` (116 `.ts` files), `backend/prisma/*.prisma` (3 schema files, 18 migrations by name only), `backend/scripts/*`, `app/**` (`.vue`/`.ts`, 89 files), `types/index.ts`, `app/types/contributions.ts`, `app/app.config.ts`, `nuxt.config.ts`, `i18n/{el,en}.json` (namespaces, not every key), `.github/workflows/verify.yml`, `docker-compose*`/`nginx` (existence and roles only).

**Out of scope / not inspected**: `assets/`, `public/`, `backend/prisma/seed*.ts` contents beyond what MODULE-REGISTRY records, `node_modules`, the legacy `PETSHOPCY-MANUAL.md`, per-key i18n usage, CSS.

**Method**
1. Mechanical graph: `node backend/scripts/audit-extraction-readiness.js --json` — file discovery, import edges (runtime vs type-only), constructor DI edges, Prisma model edges mapped to schema ownership, Nuxt auto-import edges (components from templates, composables/stores by `useXxx(`), `app.config` component contributions, `events.emit/on`, config readers, Tarjan cycles, top-level folder cycles. Limitations in §14.
2. Reading: every backend module file, every frontend page/layout/plugin/middleware/store/composable/util, both schema files, `app.config.ts`, `nuxt.config.ts`, `main.ts`/`app.module.ts`.
3. Cross-check against the existing gates: `verify-boundaries.js` (rules A–E), `verify-routes.js` (65-route snapshot), `verify-providers.js`.
4. Ownership categories: `CORE`, `SHOP`, `SHARED-CONTRACT`, `INFRASTRUCTURE`, `PRESENTATION`, `BLOCKED` (+ `PROJECT` for this shop's own brand/content, which the blueprint calls the project layer). A row may carry a secondary note.

**Extraction status vocabulary**: **Ready** (move as-is, imports rewritten only) · **Ready after cleanup** (a named small change first) · **Blocked** (ownership/contract/schema/config change needed) · **Stays** (composition root or project-specific by design).

---

## 3. Backend ownership inventory

Layer map (blueprint §2, encoded in `verify-boundaries.js` and the audit script): INFRASTRUCTURE = `infrastructure/` (since E2, 2026-09-20: `prisma redis storage payments-provider mail health common` under it; before E2 they were seven top-level folders); CORE = `core auth users profile staff settings notifications newsletter uploads`; SHOP = `products categories favourites orders payments loyalty analytics`; ROOT = `app.module.ts`, `main.ts`. 116 files: CORE 52, SHOP 42, INFRASTRUCTURE 20, ROOT 2, unmapped 0.

### 3.1 Infrastructure

| Path | Category | Owner | Important dependencies | Status | Blocker | Notes |
|---|---|---|---|---|---|---|
| `infrastructure/prisma/` (`PrismaService`, `@Global` module) | INFRASTRUCTURE | infra | `@prisma/client` | Ready | — | Single client for all three schema files; referenced by 17 files (15 constructor injections) |
| `infrastructure/redis/` (`RedisService`, `@Global`) | INFRASTRUCTURE | infra | `ioredis`, `REDIS_URL` | Ready | — | Fail-soft (WARN) get/set/del/exists/delPattern/ping; factory provider `Redis` (unresolved DI token by design) |
| `infrastructure/storage/` (`StorageAdapter` abstract, `MinioStorageAdapter`, `LocalDisabledStorage`) | INFRASTRUCTURE | infra | `minio` | Ready | — | Owns `isStorageConfigured` (`storage.module.ts`, mirrors the storage block of the boot schema) — F1 closed |
| `infrastructure/payments-provider/` (`PaymentProvider` abstract, `StripePaymentProvider`, `WebhookEvent`) | INFRASTRUCTURE (contract) / SHARED-CONTRACT (`payment-provider.ts` types) | infra | `stripe` | Ready | — | Owns `isPaymentsConfigured` (`stripe.provider.ts`) — F1 closed. Provider-neutral `WebhookEvent { checkoutCompleted \| checkoutExpired }`; only consumer is Shop `payments` |
| `infrastructure/mail/` (`MailService`, transports smtp/resend) | INFRASTRUCTURE | infra | `nodemailer`, `resend` | Ready | — | Owns `isMailConfigured` (`mail.service.ts`) — F1 closed. Never throws; templates live with their modules (`orders/order-confirmation.mail.ts`) |
| `infrastructure/health/` | INFRASTRUCTURE | infra | `@nestjs/terminus`, `PrismaService`, `RedisService` | Ready | — | `/health` 503 if Postgres or Redis down |
| `infrastructure/common/` (`GlobalExceptionFilter`, `SnakeCaseInterceptor`, `serialize.ts`, `after-commit.ts`) | INFRASTRUCTURE / SHARED-CONTRACT | infra | `@nestjs/common`, Prisma error codes | Ready | — | `afterCommit()` is the detached post-commit policy (R7); `toCache()` Decimal-safe JSON |
| `core/config/env.validation.ts` | CORE (composition-root boot contract) | core / root | `joi`, `ConfigService` | Stays | — | Joi schema for every env var (Core block required, provider blocks conditional) + Core's own `isGoogleAuthConfigured()`. Imported by `app.module.ts` (ROOT) and `auth/` (Core) only. The provider presence helpers moved next to their providers (F1). The provider Joi blocks stay here deliberately: they are the *application's* boot contract, composed at the root, and splitting them would only move env knowledge around (§8 F1 decision) |
| `prisma/infrastructure.prisma` (`ProcessedEvent { eventId, eventType, subjectId, processedAt }`) | INFRASTRUCTURE | infra | — | Ready | — | Neutral ledger since `20260919120000_processed_event_subject`; written only by Shop `payments` (expected) |

### 3.2 Core

| Path | Category | Owner | Important dependencies | Status | Blocker | Notes |
|---|---|---|---|---|---|---|
| `auth/` — `AuthService`, `AuthController` (9 routes), `JwtStrategy`, `GoogleStrategy` (factory, nullable), guards `JwtAuthGuard`/`OptionalJwtAuthGuard`/`PermissionsGuard`/`GoogleAuthGuard`, decorators `CurrentUser`/`RequirePermissions`, `permissions.ts`, `PermissionsRegistryService` (`@Global PermissionsModule`) | CORE | core | `users/` (`UsersService`, `UserExtensionsRegistry`, `roles.ts`), `core/events` (emits `user.authenticated`), `mail`, `redis` (`refresh:*`, `reset:*`), `core/config` (Google) | Ready (with `users`) | — | Guards/decorators are the cross-cutting contract every controller imports (Core and Shop). `auth→users` is the allowed direction |
| `users/` — `UsersService`, `UsersAdminController` (1 route), `UserExtensionsRegistry`, `roles.ts` | CORE | core | `prisma` (`user`), `auth/guards` + `auth/decorators` only | Ready (with `auth`) | — | Owns `OWNER_ROLE`/`MEMBER_ROLE`; rule E forbids other `users→auth` imports. Extension registry = the seam through which Shop puts `loyaltyPoints`/`_count.orders` on user payloads |
| `core/events/` — `CoreEventBus` (`@Global`), `CoreEventMap` (`user.authenticated`) | CORE / SHARED-CONTRACT (types) | core | — | Ready | — | One publisher (`auth.service`), one subscriber (`orders/guest-order-linker.service`). Log-and-continue |
| `profile/` — `ProfileService`, `ProfileController` (2) | CORE | core | `users`, `auth` (`PermissionsRegistryService` for `permissions[]`) | Ready | — | No Prisma access; applies user extensions |
| `staff/` — `StaffService`, `StaffController` (5) | CORE | core | `prisma` (`user`), `auth/permissions` (roles via re-export), `PermissionsRegistryService` | Ready | — | Last-owner guard |
| `settings/` — `SettingsService` (registry: `define/defineGroups`, `getAll/getPublic/updateAdminSettings`), `SettingDefinition`, controllers (3) | CORE / SHARED-CONTRACT (`setting-definition.ts`) | core | `prisma` (`setting`), `redis` (`settings:all`), `auth` | Ready | — | Shop contributes definitions (`orders/pricing-settings.ts`) — registry, not import into Core |
| `notifications/` — `NotificationsService` (rows, `createWrite`, `findOpen/create/update/resolveOpen`, unread caches), staff inbox controller (4), customer feed controller (4) | CORE | core | `prisma` (`notification`), `redis` (`notifications:unread:*`), `auth` | Ready | — | Row contract only; producers are Shop (`orders/order-notifications.service`, `products/stock-alerts.service`). `NotificationType` enum in `core.prisma` carries `LOW_STOCK`/`OUT_OF_STOCK`/`ORDER_STATUS` — see §7 (schema-level residue) |
| `newsletter/` — `NewsletterService`, public (2) + admin (1) controllers | CORE | core | `prisma` (`newsletterSubscriber`), `mail`, `ConfigService` (HMAC secret) | Ready | — | Welcome mail fire-and-forget (`MailService` logs) |
| `uploads/` — `UploadsService`, `UploadsController` (1) | CORE | core | `storage` (`StorageAdapter`), `auth` | Ready | — | Validation + `put()`; consumers: `products` (image sub-resource) |
| `app.module.ts`, `main.ts` | ROOT (composition) | project | every module; `rawBody: true` for Stripe | Stays | — | Becomes the place that lists enabled modules (Module Registry, roadmap C2) |

### 3.3 Shop (e-commerce module — one module, seven sub-domains)

| Path | Category | Owner | Important dependencies (Core/Infra) | Status | Blocker | Notes |
|---|---|---|---|---|---|---|
| `products/` — `ProductsService`, `StockAlertsService`, `CatalogPermissions`, public (4) + admin (8) controllers | SHOP | shop | `notifications` (`NotificationsService`), `uploads` (`UploadsService`), `storage`, `redis` (`products:*`), `auth` guards | Ready | — | Registers `view:catalog`/`manage:catalog`/`manage:inventory` + `stock_manager` preset |
| `categories/` — service, public (1) + admin (4) | SHOP | shop | `products` (`invalidate()`), `redis` (`categories:tree`), `auth` guards | Ready | — | |
| `favourites/` — service, controller (3) | SHOP | shop | `prisma` (`favourite`), `storage`, `auth` | Ready | — | |
| `orders/` — `OrdersService`, `PricingSettingsService` (+ `pricing-settings.ts` definitions, public `GET /settings`), `GuestOrderLinkerService`, `OrderNotificationsService`, `OrdersPermissions` (+ `accountant` preset), `OrdersUserExtension`, `order-confirmation.mail.ts`, `order-status.ts`, controllers (4 + 2) | SHOP | shop | `products`, `settings` (registry), `users` (`UserExtensionsRegistry`), `loyalty`, `analytics`, `notifications`, `mail`, `storage`, `core/events` (subscribes), `common/after-commit`, `prisma.user` read (**F2**) | Ready after cleanup | F2 (optional) | `orders.service.create` does `prisma.user.findUniqueOrThrow` — Shop reading a Core model; a `UsersService.exists()` would remove it. Registers shop role presets (F10) because there is no shop root module yet |
| `payments/` — `PaymentsService`, `PaymentsController` (3 incl. webhook) | SHOP | shop | `orders`, `loyalty`, `analytics`, `payments-provider` (`PaymentProvider`), `prisma.processedEvent`, `mail`, `common/after-commit` | Ready | — | Cross-sub-domain `order` writes inside the ledger transaction (F3, accepted) |
| `loyalty/` — `LoyaltyService`, `LoyaltyUserExtension`, `LoyaltyController` (1) | SHOP | shop | `users` (`UserExtensionsRegistry`), `prisma` (`loyaltyAccount`, `loyaltyTransaction`) | Ready | — | Balance is `LoyaltyAccount.points`; earn/redeem/reverse only here |
| `analytics/` — `AnalyticsService`, `AnalyticsPermissions`, controllers (1 + 1) | SHOP | shop | `redis` (`analytics:*`), `prisma.user` count with `MEMBER_ROLE` (**F2**) | Ready after cleanup | F2 (optional) | Registers `view:finance` |
| `prisma/ecommerce.prisma` — `Category Product Order OrderItem LoyaltyAccount LoyaltyTransaction Favourite` + enums | SHOP | shop | relations to `User` (4× `userId`, `SetNull`/`Cascade`) | Ready | — | `core.prisma` `User` carries the back-relations `orders[]`, `favourites[]`, `loyaltyTransactions[]`, `loyaltyAccount?` — schema-level Core→Shop knowledge Prisma requires (§7) |

Not present in this codebase (checked): cart persistence (cart is a client Pinia store), inventory module beyond `Product.stock` + stock alerts, scheduled jobs/cron/queues (none; `ProcessedEvent`/notifications retention noted in EVENT-REGISTRY R11), refunds.

---

## 4. Frontend ownership inventory

91 files (`app/**` + `types/`): CORE 39, SHOP 40, PROJECT 10, SHARED 2. Ownership is per file (F8: shop files still live in Core folders).

### 4.1 Core (reusable shell, session, access, notifications, Core admin)

| Path | Category | Owner | Important dependencies | Status | Blocker | Notes |
|---|---|---|---|---|---|---|
| `app.vue` | CORE / PRESENTATION | core | `utils/business.ts`, `useBusinessSchema()` (**PROJECT**) | Blocked | P1 | SEO/schema of the *business* hard-coded in the root |
| `layouts/default.vue`, `components/layout/AppHeader.vue`, `AppFooter.vue` | CORE / PRESENTATION | core | `app.config` `navItems/headerActions/globalWidgets` (dynamic `<component :is>`), `BrandLockup` (**PROJECT**), `WhatsAppButton` (**PROJECT**), `utils/business.ts` (**PROJECT**), footer hard-codes `/products`, `/account/orders` (**F5**) | Blocked | P1, F5 | Registry-driven for actions/widgets; brand and footer links are not |
| `layouts/admin.vue` + `pages/admin/index.vue`… shell parts (`AdminIcon`, `AdminInfo`, `DateRangeControl`) | CORE / PRESENTATION | core | `useAdminRegistry`, `usePermissions`, `useAdminNotifications`, `BrandLockup` (**PROJECT**) | Blocked (brand only) | P1 | Sections from `app.config.adminSections` — no section knowledge in the shell |
| `pages/login.vue`, `forgot-password.vue`, `reset-password.vue`, `auth/callback.vue`, `unsubscribe.vue` | CORE / PRESENTATION | core | `useApi`, `useAuthStore`, `BrandLockup` (**PROJECT**), `utils/business.ts` (unsubscribe) | Blocked (brand only) | P1 | |
| `pages/account/index.vue`, `notifications.vue`, `components/account/AccountSidebar.vue` | CORE / PRESENTATION | core | `app.config.accountItems/accountCards` (dynamic), `useCustomerNotifications` | Ready | — | Renders Shop cards only through registry strings |
| `pages/admin/{customers,newsletter,notifications,settings,staff}/index.vue` | CORE / PRESENTATION | core | `useApi`, `usePermissions`, `utils/settings-form.ts`, `types` | Ready with notes | — | `customers` shows extension columns (`_count.orders`, `loyalty_points`) typed locally; `notifications` (staff inbox) branches on `low_stock`/`out_of_stock` (B5 residue) — both are Core pages rendering module data, see §7 |
| `components/notifications/NotificationBell.global.vue` | CORE / PRESENTATION | core | `useCustomerNotifications`, `describeNotification` via composable | Ready | — | |
| `stores/auth.ts` | CORE | core | `useApi`, `types.Profile` | Ready | — | No module field since seam 2 |
| `composables/useApi.ts` | CORE / SHARED-CONTRACT | core | `useRuntimeConfig().public.apiBase`, `api:unauthenticated` hook | Ready | — | The one HTTP door; 21 Shop→Core edges land here |
| `composables/usePermissions.ts`, `useAdminRegistry.ts`, `useAdminNotifications.ts`, `useCustomerNotifications.ts`, `useAuthInputClass.ts` | CORE | core | `useAuthStore`, `useAppConfig`, `utils/admin-registry.ts`, `utils/notification-presenters.ts` | Ready | — | |
| `utils/admin-registry.ts`, `settings-form.ts`, `notification-presenters.ts` | CORE / SHARED-CONTRACT | core | `types/contributions.ts`, `types/index.ts` | Ready | — | Pure; unit-tested (`tests/*.test.mjs`) |
| `plugins/auth.server.ts`, `auth.client.ts`, `auth-hooks.ts`, `color-mode.client.ts` | CORE | core | `useApi`, `useAuthStore`, `useRuntimeConfig` | Ready | — | |
| `middleware/auth.ts`, `admin.ts`, `guest.ts` | CORE | core | `useAuthStore`, `usePermissions` (admin) | Ready | — | Named middleware only |
| `app/types/contributions.ts` | SHARED-CONTRACT | core | — | Ready | — | Registry contribution shapes (nav, header, widgets, account, admin) |

### 4.2 Shop (moves to the e-commerce layer)

| Path | Category | Owner | Core surface used | Status | Blocker | Notes |
|---|---|---|---|---|---|---|
| `pages/products/{index,[slug]}.vue`, `pages/brands.vue`, `components/product/*`, `components/filters/*`, `components/BrandsMarquee.vue`, `composables/useProducts.ts`, `stores/filters.ts` | SHOP / PRESENTATION | shop | `useApi`, `useCurrency` (shop), `HeaderSearch` reads Core key `header.search_placeholder` (F5) | Ready | — | Component prefixing (`Shop*`) at move time (blueprint §10) |
| `components/cart/*`, `stores/cart.ts`, `composables/useCartDrawer.ts`, `pages/checkout/{index,success,cancel}.vue`, `components/checkout/*` | SHOP / PRESENTATION | shop | `useApi`, `useAuthStore` (`isLoggedIn`, `profile`), `useLoyalty` (shop) | Ready | — | Cart is client-only Pinia (persisted) |
| `pages/account/orders/{index,[id]}.vue`, `composables/useOrderPresentation.ts` | SHOP / PRESENTATION | shop | `useApi`, `AccountSidebar` (Core component) | Ready | — | |
| `pages/account/{loyalty,favourites}.vue`, `components/loyalty/*`, `components/account/AccountStats.global.vue`, `composables/useLoyalty.ts`, `utils/loyalty.ts`, `stores/favourites.ts` | SHOP / PRESENTATION | shop | `useAuthStore.profile` (extension field), `useApi`, `AccountSidebar` | Ready | — | Contributed to the account dashboard via `app.config.accountCards` |
| `pages/admin/{index,analytics,products,categories,orders}/index.vue`, `components/admin/ProductDrawer.vue` | SHOP / PRESENTATION | shop | `useApi`, `usePermissions`, `DateRangeControl`, `AdminInfo` (Core shell parts) | Ready | — | Sections declared in `app.config.adminSections` (move to the layer's `app.config`) |
| `utils/order-notification-presenter.ts`, `plugins/order-notifications.ts` | SHOP | shop | `utils/notification-presenters.ts` (Core registry) | Ready | — | Presenter contribution (seam 3) |
| `composables/useCurrency.ts` | SHOP (today) | shop | `useI18n` | Ready with note | — | Formatting currency is arguably Core/project (blueprint: currency from project config, roadmap C3); classified Shop because only shop files use it |

### 4.3 Project (this shop's own content — the future `app/project` layer)

| Path | Category | Notes |
|---|---|---|
| `app.config.ts` | PROJECT (configuration) | Composes Core + Shop: `navItems`, `headerActions` (HeaderSearch, NotificationBell, CartButton), `globalWidgets` (CartDrawer), `accountItems/Cards` (LoyaltyCard, AccountStats), `adminGroups/Sections`. The 5 Core→Shop registry edges the tool reports originate here — by design |
| `utils/business.ts`, `composables/useBusinessSchema.ts`, `useOpeningHours.ts` | PROJECT | Business facts (name, address, hours) — the blueprint's `project.config.ts` |
| `components/BrandLockup.vue`, `BrandWordmark.vue`, `components/layout/WhatsAppButton.vue` | PROJECT / PRESENTATION | Brand; imported by Core shells (**P1**) |
| `pages/index.vue`, `about.vue`, `contact.vue` | PROJECT / PRESENTATION | Storefront home (uses Shop `ProductGrid`, `BrandsMarquee`), static pages |

### 4.4 Shared

| Path | Category | Notes |
|---|---|---|
| `types/index.ts` | SHARED-CONTRACT (mixed) | Core: `Profile` (+ extension index signature), `Notification*`, `NotificationType`, `Setting*`, `AdminSettingsPayload`. Shop: `Category`, `Product`, `Order*`, `ShippingAddress`, `FulfillmentType`, `PaymentMethod/Status`, `CartItem`, `LoyaltyTransaction`, `LoyaltyProfileExtension`, `CreateOrderPayload`. Importers: Core 12 edges, Shop 12, Project 2. Split = move declarations, rewrite imports (F7) |
| `i18n/el.json`, `en.json` | PRESENTATION (mixed) | Namespaces: Core — `header nav auth account notifications admin(shell/customers/staff/newsletter/settings keys) login common seo footer newsletter unsubscribe`; Shop — `home(product sections) products product cart checkout filters loyalty favourites orders admin(products/categories/orders/analytics/stock keys) brands`; Project — `home about contact whatsapp hero testimonials`. Nuxt i18n merges layer files; `admin.*` and `home.*` need a key-level split |
| `nuxt.config.ts` | PROJECT / configuration | Modules, i18n locales, `runtimeConfig.public.apiBase`, `components` pathPrefix false. Layer split turns it into `extends` |

---

## 5. Backend dependency graph summary

411 edges: runtime `import` 286, constructor `di` 90, `type` 11, Prisma model access 24.

| Direction | Edges | Content | Verdict |
|---|---|---|---|
| SHOP → CORE | 53 code edges (+2 Prisma `user` reads, **F2**) | guards/decorators (24), `PermissionsRegistryService` (6), `UserExtensionsRegistry` + `UsersModule` (6), `NotificationsService`/module (6), `SettingsService`/module/`setting-definition` (4), `UploadsService`/module (3), `CoreEventBus`/types (3), `auth/permissions` re-export (1) | Allowed. Every target is on Core's exported surface except the two direct `user` reads |
| SHOP → INFRASTRUCTURE | 43 code edges (+1 `processedEvent` model edge) | `PrismaService`/module (21), `RedisService` (6), `StorageAdapter` (6), `MailService` (5), `afterCommit` (2), `PaymentProvider` (2), `serialize` (1) | Allowed. Edge counts are import + injection per file |
| CORE → INFRASTRUCTURE | 24 | `PrismaService` (12), `RedisService` (6), `MailService` (4), `StorageAdapter` (2) | Allowed |
| **INFRASTRUCTURE → CORE** | **0** (was 3) | ~~`mail.service`, `stripe.provider`, `storage.module` → `core/config/env.validation.ts`~~ | **F1 closed**: each provider defines its one-line presence rule locally; `verify-boundaries` rule A now fails any new INFRA→CORE import |
| CORE → SHOP | 0 code, 0 Prisma | — | Clean (rule A + rule D) |
| INFRASTRUCTURE → SHOP | 0 | — | Clean |
| ROOT → all | 26 | `app.module.ts` lists 21 modules | Composition root |

**Inside Shop** (sub-domain graph, runtime): `categories→products`, `orders→{products, loyalty, analytics}`, `payments→{orders, loyalty, analytics}`. Acyclic. **Inside Core**: `auth→{core, users}`, `profile→{auth, users}`, `{staff, settings, notifications, newsletter, uploads, users}→auth` (guards/registry). Folder cycle **`auth↔users`** = `auth.service/jwt.strategy → users.service` and `users-admin.controller → auth/guards|decorators`; no file-level cycle; rule E keeps it to the guard contract.

**Dependency injection**: 90 constructor edges, all class-token; 3 factory tokens the tool cannot follow (`Redis`, `Minio`, `HealthIndicatorService`) — all inside Infrastructure. `@Global()` modules: `PrismaModule`, `RedisModule`, `MailModule`, `StorageModule`, `PaymentsProviderModule`, `PermissionsModule`, `CoreEventModule` — these are invisible in `imports:` metadata; the DI edges above make them visible.

**Events**: one bus event `user.authenticated` — publisher `auth/auth.service.ts` (Core), subscriber `orders/guest-order-linker.service.ts` (Shop). Direction Shop→Core (subscribes to Core's exported bus). Webhooks are integration events (`WebhookEvent`, Infrastructure → Shop `payments`). Notification and stock producers are direct calls (EVENT-REGISTRY §1.3).

**Database**: 24 model edges. Core services touch only `user`, `setting`, `notification`, `newsletterSubscriber`. Shop touches its 7 models, `processedEvent` (Infrastructure ledger, by pattern) and **`user` twice** (F2: `orders.service.create` existence check, `analytics.service` customer counts with `MEMBER_ROLE`). Schema: `core.prisma` declares back-relations to Shop models (Prisma requires both sides) and the `NotificationType` enum with Shop values — the two schema-level Core→Shop facts (§7).

**Configuration**: 15 files read `ConfigService`/`process.env`; all env keys are validated centrally by `env.validation.ts`. Core needs `DATABASE_URL REDIS_URL JWT_SECRET JWT_REFRESH_SECRET` (+ optional Google, mail); Shop adds `STRIPE_*`; Infrastructure adds `MINIO_*`, `MAIL_*`/`SMTP_*`/`RESEND_*` (`verify-providers.js` proves Core boots without the optional ones).

**Type-only edges (11)**: all inside a layer or Shop→Core/Infra (`guest-order-linker → core-event.types`, `order-confirmation.mail → mail.service`, `pricing-settings → setting-definition`). None cross a forbidden direction.

---

## 6. Frontend dependency graph summary

193 resolved edges: Nuxt `auto-import` (composables/stores) 106, `auto-component` (templates) 34, `type` 28, explicit `import` 19, `registry` (app.config component strings) 6. Plus 109 uses of package components (`U*` from `@nuxt/ui`, `NuxtLink`…), and 8 unresolved (5 dynamic `<component :is>` slots, 3 page-local components).

| Direction | Edges | Content | Verdict |
|---|---|---|---|
| SHOP → CORE | 38 | `useApi` (21), `useAuthStore` (8), `AccountSidebar` (4), `AdminInfo` (2), `DateRangeControl` (1), `notification-presenters` (2) | Allowed — exactly the documented Core surface |
| SHOP → SHARED | 12 | `types/index.ts` | Split with F7 |
| CORE → SHARED | 12 | `types/index.ts`, `types/contributions.ts` | Core-owned declarations only (checked: `Profile`, `Notification*`, `Setting*`, contributions) |
| **CORE → PROJECT** | **12** | `BrandLockup` (7: header, footer, admin layout, login, forgot/reset, unsubscribe), `utils/business.ts` (3: `app.vue`, footer, unsubscribe), `useBusinessSchema` (`app.vue`), `WhatsAppButton` (`layouts/default`) | **Blocker P1** for a reusable Core layer |
| CORE → SHOP | 0 code | — | Clean |
| PROJECT → SHOP | 7 | `app.config.ts` contributions (5), `pages/index.vue` → `ProductGrid`, `BrandsMarquee` (2) | By design: the project composes the shop |
| PROJECT → CORE | 2 | `app.config.ts` → `NotificationBell`; `about/contact` → shell only | By design |

**Hidden channels made visible**: (a) `app.config.ts` component strings resolved by `<component :is>` in `AppHeader`, `layouts/default`, `pages/account/index`, `NotificationBell` — the tool lists the contributions as `registry` edges and the render sites as unresolved slots; (b) Nuxt auto-imports — composables/stores resolved by name, utils are imported explicitly by repo convention (verified: every `utils/*` consumer has an explicit `~/utils/...` import); (c) `useState` keys are wrapped in composables (`customer-notif-*`, `admin-notif-unread` Core; `cart-open` Shop) — no cross-file key sharing found; (d) `nuxtApp.hook('api:unauthenticated')` — declared in `useApi.ts`, consumed by `plugins/auth-hooks.ts`, both Core.

**API contract dependencies**: all HTTP through `useApi` (USEAPI-MIGRATION; the only raw `$fetch` is the refresh call inside `useApi.ts` itself). Shop pages call `/products*`, `/categories*`, `/orders*`, `/payments*`, `/profile/loyalty`, `/favourites*`, `/settings`, `/admin/{products,categories,orders,analytics}*`; Core pages call `/auth*`, `/profile`, `/notifications*`, `/admin/{customers,staff,newsletter,notifications,settings}*`. Wire shapes are `types/index.ts` + snake_case interceptor.

**Translation dependencies**: `HeaderSearch` (Shop) reads Core key `header.search_placeholder` (F5); Shop presenter reads `notifications.order_*` (its own keys, in the shared file); Core `admin.*` namespace mixes Core and Shop keys.

No frontend file cycles.

---

## 7. Shared resources and contract classification

| Resource | Class | Owner | Notes / required action |
|---|---|---|---|
| `backend/src/auth/guards/*`, `auth/decorators/*` | SHARED-CONTRACT (Core-owned) | core | Imported by every controller in all layers. Stays in Core; documented exception to the `users→auth` rule |
| `auth/permissions.ts` (`Capability`, `CORE_CAPABILITIES`, role re-exports) + `PermissionsRegistryService` | SHARED-CONTRACT | core | Modules register capabilities/presets; Shop role presets registered from `orders/` (F10) until a shop root module exists |
| `users/user-extensions.registry.ts` | SHARED-CONTRACT | core | Shop contributes `loyaltyPoints`, `_count.orders` |
| `settings/setting-definition.ts` + `SettingsService.define()` | SHARED-CONTRACT | core | Shop contributes pricing definitions |
| `core/events/core-event.types.ts` (`CoreEventMap`) | SHARED-CONTRACT | core | Typed map; module events would need the merged-map design (EVENT-REGISTRY §6.1) |
| `payments-provider/payment-provider.ts` (`PaymentProvider`, `WebhookEvent`, `CheckoutLine`) | SHARED-CONTRACT | infra | Provider-neutral; consumer Shop only |
| `common/utils/after-commit.ts`, `serialize.ts`, filter, interceptor | SHARED-CONTRACT / INFRASTRUCTURE | infra | Layer-neutral primitives |
| `core/config/env.validation.ts` | CORE / composition root | core | Boot schema + Core's Google presence check. Provider presence helpers live with their providers since F1 was closed; no Infrastructure file imports it |
| `prisma/core.prisma` back-relations `User.orders/favourites/loyaltyTransactions/loyaltyAccount` | SHARED (schema) | core file, shop knowledge | Prisma needs both relation sides in one client. Acceptable: the Core *service* code never reads them (rule D). At extraction the ecommerce schema file is optional; the `User` model then needs the back-relations removed when the module is absent — a generation-time concern, documented in blueprint §9 |
| `prisma/core.prisma` `NotificationType { LOW_STOCK OUT_OF_STOCK ORDER_STATUS }` | **BLOCKED** (schema) | core | Core enum with Shop values. Core code treats `type` as opaque; the *enum* forces a Core migration for every new module type. Change to `String` (or a module-contributed check) before a second module needs a type. Not required for this shop's extraction |
| `types/index.ts` | SHARED-CONTRACT (mixed) | — | Split into Core and Shop declaration files at layer time (F7); no semantic leak left |
| `app/types/contributions.ts` | SHARED-CONTRACT | core | Registry shapes |
| `i18n/*.json` | PRESENTATION (mixed) | — | Namespace split mechanical; `admin.*`, `home.*` need key-level triage |
| `app/app.config.ts` | PROJECT configuration | project | Contribution lists; each layer will own its entries and Nuxt merges |
| `composables/useApi.ts`, `stores/auth.ts`, `usePermissions`, `useAdminRegistry`, `AccountSidebar`, `AdminInfo`, `DateRangeControl`, `notification-presenters` | SHARED-CONTRACT (Core public surface) | core | The full list of what Shop imports from Core — freeze it as the Core layer's documented API |

---

## 8. Extraction blockers

| Id | Blocker | Layer | Kind | Evidence | Smallest fix | Blocks |
|---|---|---|---|---|---|---|
| ~~**F1**~~ | ~~Infrastructure adapters import `core/config/env.validation.ts`~~ **Closed 2026-09-18.** Consumers used only the one-line runtime presence helpers (`isStorageConfigured`, `isPaymentsConfigured`, `isMailConfigured`) — no schema, type or constant. Each helper now lives with its provider (`storage/storage.module.ts`, `payments-provider/stripe.provider.ts`, `mail/mail.service.ts`), identical expressions; `env.validation.ts` keeps the boot schema and Core's `isGoogleAuthConfigured`. Options weighed: (1) move the whole file to `common/`/Infrastructure — rejected, it would add a *new* Core→Infra edge (`auth` → the moved file) and move Core's required keys into Infrastructure; (2) move only helpers to a shared file — same new edge, and it separates each rule from its Joi block's owner; (3) provider-local rules — chosen; (4) document as exception — unnecessary, fix is 3 one-liners. No re-export (all 3 importers updated), no migration, env names/validation/messages unchanged. `verify-boundaries` rule A widened to INFRA→CORE; audit positive test asserts `backend.forbidden = []`. Verified: typecheck, build, 8/8 tests, boundaries 0 (negative control fails on a re-added import), routes 65/65, providers (core-only → all 503; partial-minio/google/stripe rejected at boot with the same Joi messages; full → storage/payments/mail/google enabled; resend → mail enabled) | backend | placement / config | 0 forbidden edges | — | — |
| **P1** | Core shells/pages import project brand (`BrandLockup` ×7, `WhatsAppButton`, `utils/business.ts` ×3, `useBusinessSchema`) | frontend | ownership / config | 12 forbidden CORE→PROJECT edges | Brand as a slot/contribution: `app.config.brand` (`{ component: 'BrandLockup' }` rendered with `<component :is>` like header actions) or a Core `BrandSlot` component overridden by the project layer (Nuxt layer component override); `useBusinessSchema`/`BUSINESS` moved behind a Core `useProjectConfig()` fed by `app.config`/`runtimeConfig` (roadmap C3) | Reusable Core frontend layer |
| **F5** | `AppFooter` hard-codes `/products`, `/account/orders`; `HeaderSearch` reads `header.search_placeholder` | frontend | presentation | grep (not an import edge) | `app.config.footerLinks[]` contribution; own key for HeaderSearch | Shop-free Core shell (soft) |
| **F7** | `types/index.ts`, `i18n/*.json` mixed | frontend | type / presentation | 12+12 SHARED importers | Mechanical split at layer creation | None at runtime; required at move time |
| **S1** | `core.prisma` `NotificationType` enum carries Shop values | backend | schema | schema read | `type String` + module-side validation, one migration | Only a *second* module with notification types; not this extraction |
| **S2** | `core.prisma` `User` back-relations to Shop models | backend | schema | schema read | None now; at packaging, generate the schema from enabled modules (blueprint §9) | Optional-module builds only |
| **F2** | Shop reads `prisma.user` directly (2 sites) | backend | convention | audit `corePrismaFromShop` | `UsersService.exists()` / `countCustomers()` | None (reads only); cleanup |
| **F10** | Shop role presets registered from `orders/` | backend | placement | code read | Move to the shop root module (`ecommerce.module.ts`) when it exists | None; cosmetic |
| **B5r** | Staff inbox page (`pages/admin/notifications/index.vue`) knows stock types | frontend | presentation | code read | Treat the page as Shop (move with shop admin pages) or presenter-ise the inbox | Shop-free Core admin (soft) |

---

## 9. Extraction-ready candidates (move as-is; only import paths change)

| Candidate | Files | Why ready |
|---|---|---|
| Backend Shop package `modules/ecommerce/` = `products categories favourites orders payments loyalty analytics` + `ecommerce.prisma` | 42 + 1 schema | 0 inbound from Core/Infra; outbound only to Core's exported services and Infra adapters; registries carry permissions/settings/user-extensions/presenters; `verify-routes` snapshot pins every route |
| Backend Core (as one package) `auth users profile staff settings notifications newsletter uploads core/events` | 52 | 0 Core→Shop; internal folder cycle is the guard contract; `env.validation` placement is F1 (Infra side) |
| ~~Backend Infrastructure~~ `backend/src/infrastructure/{prisma,redis,storage,payments-provider,mail,health,common}` | 20 | **Moved (E2, 2026-09-20)**: 20 × `git mv` (R100), 46 relative-import rewrites in 24 files, 4 tooling/test path updates; edge set identical to pre-move after path normalisation (408 edges), routes 65/65 byte-identical, providers unchanged |
| Frontend Shop layer (`app/modules/ecommerce`): 40 files in §4.2 + their `app.config` entries + `types` Shop declarations + `i18n` Shop namespaces | 40 | 0 Core→Shop code edges; 38 Shop→Core edges all on the Core surface; presenter + registry contributions in place; needs `Shop*` component prefixes (blueprint §10) |
| Frontend Core utilities (`useApi`, `usePermissions`, registries, presenters, stores/auth, middleware, plugins) | 20 | Pure Core; unit tests exist for the pure helpers |

---

## 10. Candidates requiring small cleanup

| Candidate | Cleanup | Size |
|---|---|---|
| ~~Backend Infrastructure~~ | ~~F1~~ done — provider-local presence rules; rule A widened | — |
| Backend `orders`, `analytics` | F2: `UsersService.exists()` / `countCustomers()` (optional; reads only) | 2 methods, 2 call sites |
| Frontend Core shells | P1 + F5: brand slot/contribution, footer links contribution, HeaderSearch key | 7 components/pages, `app.config` keys, `contributions.ts` types |
| `types/index.ts`, `i18n/*.json` | F7 split (at layer creation, mechanical) | ~25 import rewrites; two JSON files → four |
| `pages/admin/notifications/index.vue` | Decide owner (Shop) or presenter-ise | 1 page |
| `useCurrency` | Decide owner (Core/project config vs Shop) | 1 composable |

---

## 11. Proposed extraction order

Each step leaves the app green (`npm run verify`, `pnpm lint/typecheck/test/build`, harness suites) and is independently revertible (a move + import rewrite, no behaviour).

1. ~~**F1**~~ **Done** — provider-local presence rules (no file move needed); INFRA→CORE added to `verify-boundaries` rule A. *Backend has zero forbidden edges.*
2. **Backend folder layers** — `backend/src/{infrastructure,core,modules/ecommerce}/…` (blueprint Phase 1). *`infrastructure/` done (E2).* Remaining: `core/`, `modules/ecommerce/` — pure moves; update the layer map in `verify-boundaries.js` and the audit script to the new paths; `verify-routes` snapshot must not change (paths are routes, not folders). Create `modules/ecommerce/ecommerce.module.ts` as the shop root and move the role presets there (F10).
3. **F2** (optional, same PR as 2 or after) — `UsersService.exists()/countCustomers()`.
4. **Frontend Shop layer** — `app/modules/ecommerce/{pages,components,composables,stores,utils,plugins,app.config.ts,i18n}`; `Shop*` prefixes; Shop `types` and `i18n` split out (F7, shop half). Root `nuxt.config.ts` `extends` the layer. Core→Shop still 0 by construction.
5. **P1 + F5** — brand/footer contributions; then **frontend Core layer** `app/core/…` with the Core half of `types`/`i18n`; project layer keeps `app.config.ts`, brand components, `business.ts`, home/about/contact.
6. **Module Registry / enabled modules** (roadmap C2) — `app.module.ts` and `nuxt.config.ts` read one `modules.registry`; the audit script and `verify-boundaries` read the same registry instead of path arrays (F11).
7. Later, only when needed: **S1** (`NotificationType` → string), **S2** (schema generation per enabled module), Event Registry code (merged `EventMap`).

---

## 12. Recommended first extraction slice

**Slice: backend Infrastructure package** — **done 2026-09-20 (E2)** exactly as scoped below; kept as the record of what was executed.

- Scope: create `backend/src/infrastructure/{prisma,redis,storage,payments-provider,mail,health,common}/`, move the 20 files, rewrite imports (all relative today — `sed`-able), update `verify-boundaries.js` layer map and the audit script's `BE_INFRA` prefix, keep `app.module.ts` imports. `env.validation.ts` stays in `core/config` (boot contract).
- Why first: smallest blast radius (adapters have no business logic; Infrastructure imports nothing from Core or Shop), proves the move mechanics (paths, scripts, CI) before touching Core/Shop.
- Verification: `npm run verify` (routes snapshot unchanged, boundaries 0, providers scenarios unchanged), `npm test` (audit positive test updated to the new layer paths), DI/HTTP harness on a scratch DB (health, webhook, mail stub), `pnpm build` untouched.
- Rollback: `git revert` of one commit; no schema, no data, no API change.

Alternative if backend is frozen: **frontend Shop layer** (step 4) — equally reversible, but larger (40 files + config + i18n + component renames) and it needs the `Shop*` prefix decision.

---

## 13. Risks and rollback considerations

| Risk | Where | Mitigation |
|---|---|---|
| Import-path churn hides a real change | every move | Moves as separate commits from any behaviour change; `verify-routes` snapshot must be byte-identical; audit JSON compared before/after (same edge counts, only paths differ) |
| Nest global modules resolve differently after folder moves | backend steps 1–2 | They don't (globals are by class); `verify-providers` boot scenarios cover it |
| Nuxt auto-import name collisions across layers | frontend steps 4–5 | Blueprint §10 prefixing (`Shop*`, `Core*`); Nuxt build fails on duplicate names only with a check — add a duplicate-name script when layers land (DEPENDENCY-RULES §10 "not yet enforced") |
| i18n key split loses a key | step 4/5 | Compare flattened key sets before/after (script-able); the UI harnesses (`nt3/nt5/sr/ar/ua`) render EL and EN |
| `types/index.ts` split breaks `structuredClone`/SSR payload typing | step 4/5 | Types only; `pnpm typecheck` is the gate |
| Schema files and Prisma client | step 2 | `prisma/*.prisma` stay where the `package.json#prisma.schema` points; only `src/` moves. No migration |
| Registries silently lose a contribution after a move | all | Registry-level tests exist (`tests/admin-registry`, `settings-form`, `notification-presenters`); add a boot assertion listing registered permission/setting/extension ids in the DI harness |
| Rollback | all | Every step is a pure move; `git revert` restores the tree; no data or contract to roll back |

---

## 14. Verification and reproducibility

**Command**: `cd backend && npm run audit:extraction` (human summary) · `npm run audit:extraction -- --json` (machine) · `-- --strict` exits 1 on a forbidden edge.

**Tests**: `backend/test/audit-extraction-readiness.test.mjs` — positive run on the real tree (asserts the baseline: **no** forbidden backend edge, no Core→Shop, `auth↔users` the only folder cycle, deterministic output) and negative run on a synthetic tree (forbidden import + DI edge, Shop→Core type import allowed, file + folder cycle, Infra→Shop Prisma edge, auto-component and auto-import edges, comment false-positive guard, `--strict` exit 1). Runs in `npm test`, therefore in `npm run verify` and CI.

**Wiring decision**: the script is **not** a separate step of the verify chain; it is exercised by `npm test` and the positive test pins the baseline, so a new Core→Shop edge (backend or frontend), a new cycle, or a new forbidden direction fails CI. `--strict` stays a manual flag because the frontend baseline (12 CORE→PROJECT edges) is a known, documented state that must not block unrelated work until P1 is done.

**What the script resolves**: relative imports; `~/ ~~/ @/ @@/` aliases; `import type` vs runtime; constructor DI by class name; `prisma.<model>`/`tx.<model>` → schema file → layer; `events.emit/on`; `ConfigService`/`process.env` readers; Nuxt template components (`components/**`, pathPrefix false, `.global` stripped); `useXxx(` composables and `useXxxStore(` stores; `app.config` `component: 'Name'` strings; Tarjan SCCs; folder cycles.

**What it does not resolve (reported as `unresolved`, never guessed)**: dynamic `import()` (none in the tree), `<component :is>` targets (5 sites, all registry-driven), page-local components (`LineChart`, `SortIcon`), factory/token DI (`Redis`, `Minio`, `HealthIndicatorService`), Prisma relations traversed via `include/select`, i18n key usage, `useState` key sharing (checked by hand), barrel re-exports (the only re-export in either tree is `auth/permissions.ts` → `users/roles.ts`, which the tool follows as an ordinary import edge; `types/index.ts` is a single declaration file, not a barrel — verified), auto-imported utils (none: utils are imported explicitly). Layers are declared path maps, not inferred; a new folder is `UNMAPPED` in the backend map and `CORE` by default in the frontend — review both maps whenever a folder is added.

**Baseline at this commit** (from the script, after F1 and E2): backend 116 files / 408 edges (411 before F1 removed its 3) / forbidden **0** / cycles 0 / folder cycle 1 (`auth↔users`; the seven Infrastructure folders are one node `infrastructure` since E2); frontend 91 files / 193 edges / forbidden 12 (all CORE→PROJECT) / Core→Shop via registry 5 / cycles 0 / unresolved 8.

---

## 15. Open questions and unresolved intentional exceptions

**Intentional exceptions (keep, documented)**
- `users-admin.controller.ts` → `auth/guards|decorators`: the cross-cutting guard contract; rule E allows exactly this.
- `payments.service` writes `order` rows inside the ledger transaction (F3): settlement must be one transaction.
- `app.config.ts` (project) references Shop and Core components by name: this *is* the composition mechanism.
- `core.prisma` back-relations to Shop models: Prisma requires both sides; Core code never reads them (rule D).
- `ProcessedEvent` written only by Shop `payments`: expected until a second webhook consumer exists.

**Open questions (decide before the corresponding step)**
1. Brand mechanism for P1: `app.config.brand` contribution rendered by Core, or Nuxt-layer component override (`BrandLockup` provided by the project layer under the same name)? Override is less code; contribution is explicit. Recommendation: contribution, consistent with header/account/admin registries.
2. `useCurrency`: Shop, or Core fed by project config (roadmap C3)? Affects where `Intl.NumberFormat` options live.
3. Staff inbox page: move with Shop admin pages, or make the inbox render through the presenter registry so Core owns the page? Recommendation: move with Shop for this project; presenter-ise when a second module writes staff notifications.
4. `NotificationType` enum (S1): change to `String` now (one small migration, before any second module) or defer? Recommendation: defer until a second module needs a type; record in DEPENDENCY-RULES §7.
5. Shop role presets (F10): create `ecommerce.module.ts` in step 2 and move them, or leave in `orders/` until the Module Registry (step 6)? Recommendation: step 2.
6. Should `verify-boundaries` and the audit script share one layer map (a small `scripts/layer-map.js`)? Two copies exist today by choice (each script self-contained); the Module Registry (F11/step 6) is the intended single source.
