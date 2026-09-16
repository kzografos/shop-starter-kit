# Dependency Rules

**Status:** Adopted with [ARCHITECTURE-BLUEPRINT.md](ARCHITECTURE-BLUEPRINT.md) · **Date:** 2026-09-14
**Audience:** every contributor and every AI agent working in this repository or a project derived from it.

These rules are written to be checked by a tool (D12). Until the tool exists, they are checked in review. A pull request that breaks one of them is not mergeable, regardless of whether it "works".

---

## 1. Layers

```text
PROJECT          app/project/**        backend/src/project/**        contracts/project.config.ts, backend/prisma/project.prisma
OPTIONAL MODULE  app/modules/<id>/**   backend/src/modules/<id>/**   backend/prisma/<id>.prisma   (today: ecommerce.prisma)
CORE             app/core/**           backend/src/core/**           backend/prisma/core.prisma
INFRASTRUCTURE   —                     backend/src/infrastructure/** backend/prisma/infrastructure.prisma, backend/prisma/migrations/, docker/, compose files
```

Until the folders exist, the mapping of **current** paths to layers is the one in the blueprint §2 and §10. The rules apply to the current paths by that mapping.

---

## 2. Allowed dependencies

```text
PROJECT        → MODULE
PROJECT        → CORE
PROJECT        → INFRASTRUCTURE      (config only: compose values, nginx blocks — never provider SDKs)
MODULE         → CORE
MODULE         → INFRASTRUCTURE      (through adapters: StorageAdapter, MailTransport, PaymentProvider, PrismaService, RedisService)
CORE           → INFRASTRUCTURE
INFRASTRUCTURE → external providers  (SDKs, drivers)
```

Same-layer:

```text
MODULE A → MODULE B  only via B's public surface (see §4)
CORE     → CORE      freely
```

---

## 3. Forbidden dependencies

```text
CORE           → MODULE               (no import, no Prisma model of a module, no module capability string, no module i18n key)
CORE           → PROJECT              (no BUSINESS constant, no brand values, no client page)
CORE           → e-commerce concepts  (products, orders, cart, favourites/wishlist, loyalty, shipping, inventory)
CORE           → Stripe business logic
CORE           → MinIO business logic (Core may call StorageAdapter; it may not know keys-vs-URLs, buckets, presign lifetimes)
INFRASTRUCTURE → CORE | MODULE | PROJECT
MODULE A       → MODULE B internals   (any file that is not B's public index)
MODULE         → PROJECT
```

"Depends on" means any of: an `import`, a Prisma model access (`prisma.<model>`), a hardcoded capability/role/setting/i18n key owned by the other unit, a Redis key in the other unit's namespace, a `useState` key defined by the other unit, a component or store defined by the other unit.

---

## 4. Module-to-module communication

A module exposes exactly one public surface: `backend/src/modules/<id>/index.ts` (and `app/modules/<id>/` exports through its layer's composables/components). Everything else is internal.

Modules may communicate through:

1. **Public service interfaces** exported from the index (e.g. `ecommerce` exports `OrdersService.findPaidForUser()`).
2. **Events** emitted through the Core event bus with names from the Event Registry.
3. **Explicit module contracts** — a documented DTO/interface exported by the provider module and imported by the consumer.

Modules must not:

- Import another module's internal file.
- **Write to another module's tables** (`prisma.<otherModel>.create/update/delete`) without a contract. Reading is tolerated only through the other module's exported service.
- **Invalidate another module's cache by string** (`redis.delPattern('products:*')` from outside `catalog`). Call the owner's `invalidate()`.
- Register admin sections, capabilities or settings on behalf of another module.

---

## 5. Frontend-specific rules

1. **Global layouts and shells** (`layouts/default.vue`, `layouts/admin.vue`, `AppHeader`, `AppFooter`, `AccountSidebar`, `account/index.vue`) must not import optional-module components, stores, composables, state keys or i18n keys. They render slots and registry lists only.
2. **Module navigation, header actions, account items, global widgets and admin sections** are contributed through `app.config` lists (Navigation slots, Admin Registry). Editing a Core component to add a module link is forbidden.
   **Implemented (seam 9) — config-driven shell contributions.** The storefront shells read five lists from `useAppConfig()`, sort them by `order` and render them without naming any module: `navItems[]` (header links, `{ to, labelKey, order }`; the shell applies `localePath()`), `headerActions[]` (`{ component, order, area?: 'center' | 'actions' }` — `center` is the flexible desktop zone between the nav and the actions, `actions` the right-hand cluster), `globalWidgets[]` (`{ component, order }`, mounted once in `layouts/default.vue`), `accountItems[]` (sidebar links `{ to, icon, labelKey, order }`, after the Core dashboard link) and `accountCards[]` (`{ component, order }`, dashboard blocks below the welcome header). Contracts live in `app/types/contributions.ts`, which also augments `CustomAppConfig` so the shells type-check when a list is absent; `app/app.config.ts` declares the entries with `satisfies` against those contracts. `component` is a **registered component name**, rendered with `<component :is>`; a contributed component therefore carries the `.global.vue` suffix (`CartButton.global.vue`, `HeaderSearch.global.vue`, `CartDrawer.global.vue`, `LoyaltyCard.global.vue`, `AccountStats.global.vue`), which makes Nuxt register it globally (as a lazy chunk) with no `nuxt.config` change. Until Nuxt layers exist the entries sit in the root `app/app.config.ts` — the frontend composition root, allowed to name everything, like `app.module.ts` on the backend — and move verbatim into each layer's `app.config.ts` (Nuxt concatenates the arrays) with no change to the shells.
3. **`useApi` is the only standard HTTP entry point.** Raw `$fetch` / `useFetch` / `$fetch.raw` against the API is allowed only:
   - inside `useApi` itself;
   - inside the SSR auth plugin (`plugins/auth.server.ts`) where request headers must be forwarded;
   - with an inline comment starting `// raw-fetch:` stating the reason, reviewed case by case.
4. **`useApi` must not import or mutate Pinia stores.** It exposes hooks (`onUnauthenticated`, later `onError`) that the auth plugin registers. Store reads/writes happen in stores and plugins, never in the client.
5. **Component naming:** when Nuxt layers are introduced, each layer sets a component prefix (`Core*`, `Shop*`, `Project*`) or `pathPrefix: true`. Two layers may not register the same component name. A collision is a build failure, not a silent override.
6. **Shared state keys** (`useState('<key>')`) are owned by the layer that defines them and are accessed only through a composable exported by that layer. Example: the cart drawer's `cart-open` key is read and written only through `app/composables/useCartDrawer.ts` (`isOpen`, `open()`, `close()`); Core never touches the key.
7. **Route middleware** (`auth`, `guest`, `admin`) is Core. Modules do not add global middleware; they declare `definePageMeta({ middleware })` on their own pages.
8. **i18n namespaces** are owned per layer. A Core template may not use a module namespace (`cart.*`, `loyalty.*`, `products.*`); a module may not add keys to a Core namespace.

---

## 6. Backend-specific rules

1. **Controllers in Core** may be guarded only by Core capabilities (`manage:staff`, `manage:settings`, `view:users`, `view:notifications`, `manage:media`). A Core controller guarded by `manage:inventory` or `manage:catalog` is a violation.
2. **Env validation** is per layer: Core's Joi fragment must not require a provider variable that only a module uses. A module declares its own fragment; the config loader merges fragments of enabled modules only.
3. **Bootstrap options** required by one module (today: `rawBody: true` for Stripe webhooks) are documented in that module's README section and in `main.ts` with a comment naming the module.
4. **Prisma access:** a service accesses only models declared in its own layer's schema file, plus Core models through Core services. `prisma.user.update()` from a module is a violation; `UsersService.…()` is not. The one sanctioned exception is a module writing its *own* relation rows that reference `userId`.
5. **Seeds** are per owner: Core seed (settings defaults from the registry, owner bootstrap), module seeds, project seed. The Core image does not embed project demo data.
6. **Cache keys** follow `<module>:<entity>:<id>:<field>` (Core uses `core:` or the existing `refresh:`/`reset:` prefixes). `delPattern` is called only on the caller's own namespace.
7. **Cross-cutting HTTP concerns** (interceptor, filter, throttler, CORS, helmet) are Core. A module may opt a controller out of throttling with `@SkipThrottle()` only for public read endpoints, and must say so in the controller.

---

## 7. Data and schema rules

1. Core models (`User`, `Setting`, `NewsletterSubscriber`, `Notification`) carry no module-specific scalar columns (the last one, `User.loyaltyPoints`, was removed in seam 2; the balance is `LoyaltyAccount.points`). A module that needs its data shown *on* a user in a client payload registers a user extension with Core's `UserExtensionsRegistry` (`users/user-extensions.registry.ts`) — `{ id, order, scopes, extend(userIds) }` — from its `onModuleInit`; Core applies extensions only where a user object is returned to the client (`/profile`, `PATCH /profile`, login/register/refresh, `/admin/customers`), never inside the JWT strategy. Loyalty reads and writes belong to the `loyalty/` domain: `LoyaltyService` is the only code that touches `loyaltyAccount` / `loyaltyTransaction`; orders, payments and guest-order linking call it inside their own transactions. A Prisma model block must be complete in one file, so module back-relations on `User` are written inside `core.prisma` and annotated as module-owned there; the owning side of the relation lives in the module's file.
2. Modules reference users by `userId` (UUID) with an explicit relation in their own file.
3. `ProcessedEvent` and similar technical ledgers are Infrastructure; modules use them through the pattern (insert inside the same transaction), not by adding domain columns to them.
4. A commit that changes a schema file is owned by that file's layer and is never cherry-picked downstream without its migration.
5. Project-specific schema lives in `project.prisma` and is additive only.

---

## 8. Configuration rules

1. Secrets and host-specific values live in environment variables only.
2. Identity, branding, theme, locales, currency and enabled modules live in `project.config.ts` only. No Core or module file hardcodes a brand name, colour, address, phone number, currency or locale list.
3. Runtime-editable business values (shipping cost, loyalty rates, …) are Settings Registry entries owned by the module that uses them.
4. `NUXT_URL`-style multi-purpose variables are not introduced; one variable, one meaning.

---

## 9. What "public surface" means for the e-commerce module in v1

Because e-commerce stays one module with internal sub-domains (`catalog`, `orders`, `payments`, `loyalty`, `analytics`, `media`), the same-layer rule applies **between sub-domains** as a convention, not yet as an enforced boundary:

- each sub-domain has an `index.ts`;
- `orders` imports `catalog` only through `catalog/index.ts`;
- cache invalidation crosses sub-domains only through exported `invalidate()` functions.

When a sub-domain is promoted to its own module, the convention becomes the rule with no code change.

---

## 10. Enforcement mapping

**Implemented and passing** (`backend`: `npm run verify` = typecheck → build → boundaries → routes → providers; CI: `.github/workflows/verify.yml` on pull requests and pushes to `main`):

| Check | Script | What it enforces |
|---|---|---|
| Boundaries | `backend/scripts/verify-boundaries.js` | §2–§3 (Core/Infra must not import shop folders), §4 (no service imports a controller), §6.1 (no shop capability on a Core controller), §6.4 (no shop Prisma model in a Core service) — on the **current flat layout**, via the folder→layer map from the blueprint §2 |
| Routes | `backend/scripts/verify-routes.js` + `route-inventory.snapshot.txt` | Every route's method, path, owning controller, guards and capabilities match the committed snapshot; no duplicate method+path; zero routes = failure. The snapshot changes only via `npm run verify:routes:update`, and its diff is reviewed in the pull request |
| Providers | `backend/scripts/verify-providers.js` | §6.2 / §8: Core boots with only its required environment; a half-configured provider is rejected; configured providers instantiate; unconfigured providers answer 503 |
| Typecheck / build | `npm run typecheck`, `npm run build` | compile-level correctness |

The boundary verifier carries a **baseline** of violations that existed at Architecture Verification Pass 10. They do not fail the check; a new violation does, and a baseline entry that stops matching fails until it is removed. Current baseline, each tied to the seam that removes it:

| Rule | File | Violation | Removed by |
|---|---|---|---|
| §6.1 | `backend/src/notifications/notifications.controller.ts` | `manage:inventory` on a Core controller | seam 5 (generic notifications) |
| §6.1 | `backend/src/uploads/uploads.controller.ts` | `manage:catalog` on a Core controller | seam 7 (media / `manage:media`) |
| ~~§6.4~~ | ~~`backend/src/profile/profile.service.ts`~~ | ~~reads `loyaltyTransaction`~~ | **removed (seam 2)** — history endpoint moved to `loyalty/loyalty.controller.ts`; baseline is now two entries |

**Not yet enforced** (planned):

| Rule | Tool | Status |
|---|---|---|
| §2–§4 on the target layout (`core/`, `modules/*/index.ts`, `infrastructure/`) | `dependency-cruiser` (new devDependency; explicit approval) | after the Phase 1 folder move; the grep-based script is the stop-gap |
| §5.3–§5.4 `useApi` | ESLint `no-restricted-syntax` on `$fetch(` / `useFetch(` outside allow-listed files; `no-restricted-imports` of `~/stores/*` in `useApi.ts` | needs `eslint` as a root devDependency (today only transitive; `pnpm lint` fails) |
| §5.5 component collisions | Nuxt build with per-layer prefix; a duplicate-name check script | Phase 2 |
| §6.6 cache namespaces | grep-based script over `delPattern('` / `redis.del('` per folder | Phase 2 |
| §7.1 Core columns | review + schema-file ownership (`core.prisma` diff reviewed by Core owner) | schema split done (seam 3b step 1); review-based until a column-ownership check exists |
| Frontend typecheck / lint / tests | `nuxi typecheck` (needs `vue-tsc`), `eslint`, Vitest; backend Jest | Phase 4 |

> Architecture rules are not complete until they are enforceable automatically.

---

## 11. Current known violations (to be removed, not to be copied)

Listed so that nobody treats them as precedent. Locations are current paths.

| Violation | Rule | Removal |
|---|---|---|
| ~~`backend/src/auth/auth.service.ts` `linkGuestOrders()` touches `order`, `loyaltyTransaction`, `setting`~~ | §3, §6.4 | **Removed (seam 1).** AuthService emits `user.authenticated` on `CoreEventBus`; `orders/guest-order-linker.service.ts` subscribes and awards points through `loyalty/loyalty.service.ts` (seam 2) |
| ~~`backend/src/users/users.service.ts` selects `loyaltyPoints` (and counts `orders`) — `User.loyaltyPoints` column~~ | §7.1 | **Removed (seam 2).** Column dropped by migration `20260917100000_loyalty_account` (backfilled into `loyalty_accounts`); `users.service` selects Core columns only and applies `UserExtensionsRegistry` (`loyaltyPoints` from the loyalty module, `_count.orders` from the orders module) on `/admin/customers` |
| ~~`backend/src/profile/*` exposes `GET /profile/loyalty` and reads `loyaltyTransaction`~~ | §3, §6.4 | **Removed (seam 2).** `loyalty/loyalty.controller.ts` serves the same path and response; `profile.service.ts` has no Prisma access and applies user extensions to `/profile` payloads |
| ~~`orders.service`, `payments.service`, `orders/loyalty.service.ts` write `loyaltyTransaction` + `user.loyaltyPoints` inline~~ | §6.4 (sub-domain convention) | **Removed (seam 2).** All loyalty writes go through `LoyaltyService.earn` / `earnWrites` / `redeem` |
| ~~`backend/src/auth/permissions.ts` defines shop capabilities and roles~~ | §3 | **Removed (seam 3a).** Core keeps only the mechanism (`auth/permissions.registry.service.ts`, global via `auth/permissions.module.ts`; `PermissionsGuard`, `RequirePermissions`, `permissionsFor`, owner bypass, untagged = owner-only) and its own four capabilities. Module-owned registrations: `products/catalog-permissions.ts`, `orders/orders-permissions.ts` (incl. the `ACCOUNTANT`/`STOCK_MANAGER` presets), `analytics/analytics-permissions.ts` |
| ~~`UserRole` Prisma enum carries `CUSTOMER`, `ACCOUNTANT`, `STOCK_MANAGER`; `staff.service` demotes to `UserRole.CUSTOMER`; `'CUSTOMER'` literal in `users.service`, `analytics.service`~~ | §3, §7.1 | **Removed (seam 3b).** `users.role` is a lowercase `text` column; Core names `admin`/`customer` (`OWNER_ROLE`/`MEMBER_ROLE`), modules register their own roles; no role enum may be reintroduced |
| frontend `usePermissions.STAFF_ROLES` / `SECTION_CAPS` duplicate the role/section vocabulary | §5.2 | Phase 2 Admin Registry (frontend) |
| ~~`backend/src/settings/settings.service.ts` `PRICING_SETTING_KEYS`; `GET /settings` returns pricing only~~ | §3, §8.3 | **Removed (seam 4).** Core `SettingsService` is a generic registry-backed store; pricing definitions in `orders/pricing-settings.ts`, `loadPricing()` in `orders/pricing-settings.service.ts`, public `GET /settings` in `orders/pricing-settings.controller.ts` |
| `backend/prisma/seed.ts` `seedSettings()` hard-codes the five pricing keys; `app/pages/admin/settings/index.vue` hard-codes the same five form fields | §8.3 | seam 4 residue — Phase 3 registry-driven seed; Phase 2 registry-driven admin form |
| ~~`backend/src/notifications/notifications.service.ts` `checkStock` / `LOW_STOCK_THRESHOLD` / `StockProduct`~~ | §3 | **Removed (seam 5b).** Stock rule now in `products/stock-alerts.service.ts`; Core keeps `findOpen`/`create`/`update`/`resolveOpen` |
| `backend/src/notifications/notifications.controller.ts` guarded by `manage:inventory`; `NotificationType` enum and `Notification.productId`/`stock` columns are product-shaped | §6.1, §7.1 | seam 5 residue — schema/capability step (boundary baseline entry) |
| `backend/src/uploads/uploads.controller.ts` guarded by `manage:catalog` | §6.1 | seam 7 |
| ~~`backend/src/mail/mail.service.ts` `sendOrderConfirmation`~~ | §3 | **Removed (seam 5a).** Template in `orders/order-confirmation.mail.ts`; Core exposes `sendMail`, `renderLayout`, `brand` |
| `backend/src/common/interceptors/snake-case.interceptor.ts` `ENUM_FIELDS` names order enums | §3 | E7 |
| ~~`backend/src/app.module.ts` Joi requires `STRIPE_*`, `MINIO_*`~~ | §6.2 | **Removed.** `core/config/env.validation.ts`: core keys required, provider keys validated only when the provider's presence key is set; Stripe / MinIO / Resend / Google clients are created only when configured and reject use with 503 otherwise |
| ~~`backend/src/admin/admin.service.ts` mixes users/newsletter/settings with shop~~ | §3, §4 | **Removed (seam 10).** Each resource's module owns its `admin/*` controller: newsletter, settings, users (customers), orders, categories, products, analytics (stats). `admin/` folder deleted |
| `products.service.ts`, `categories.service.ts` (`products:*`, `categories:tree`), `orders.service.ts` (`analytics:*`) delete cache keys by string | §4, §6.6 | seam 8 (moved with the admin extraction; still string-keyed) |
| `backend/src/products/products.service.ts` duplicates `isExternalUrl` / presign loop | §2 (adapter use) | seam 7 |
| ~~`app/layouts/default.vue` mounts `CartDrawer`~~ | §5.1 | **Removed (seam 9).** The layout renders `app.config` `globalWidgets[]` by component name; `CartDrawer.global.vue` is contributed there |
| ~~`app/components/layout/AppHeader.vue` imports cart/filters stores, `cart-open` state, shop nav~~ | §5.1, §5.6, §5.8 | **Removed (seam 9).** Nav from `navItems[]`; search box and cart button are `HeaderSearch.global.vue` / `CartButton.global.vue` contributed via `headerActions[]`; the `cart-open` key is owned by `useCartDrawer()` (module-id prefixing of the key comes with the layer split) |
| ~~`app/components/account/AccountSidebar.vue`, `app/pages/account/index.vue` hardcode shop routes and `loyalty.*` keys~~ | §5.1, §5.8 | **Removed (seam 9).** Sidebar links from `accountItems[]`; the loyalty card and the orders/favourites/points strip are `LoyaltyCard.global.vue` / `AccountStats.global.vue` contributed via `accountCards[]`; `GET /orders` and the favourites store moved with them |
| `app/components/layout/AppFooter.vue` hardcodes `/products`, `/account/orders`, `/account/loyalty` and `footer.loyalty` | §5.1, §5.8 | open — not in seam 9's scope; same `navItems`/`accountItems` mechanism applies |
| `app/components/filters/HeaderSearch.global.vue` (shop) reads the Core i18n key `header.search_placeholder` | §5.8 | seam 9 residue — key moves to a shop namespace with the per-layer i18n split (Phase 2) |
| `app/composables/usePermissions.ts` `SECTION_CAPS` / `LANDING_ORDER`; `app/layouts/admin.vue` nav buttons | §5.2 | Phase 2 Admin Registry |
| ~~`app/composables/useApi.ts` writes `useAuthStore().profile`~~ | §5.4 | **Removed.** `useApi` calls `nuxtApp.callHook('api:unauthenticated')`; `plugins/auth-hooks.ts` subscribes and calls `authStore.clearSession()` |
| 27 files read `apiBase`; every admin page uses raw `$fetch` | §5.3 | Phase 1 |
| `app/composables/useBusinessSchema.ts` hardcodes `Store`, `priceRange`, `currenciesAccepted`; `useCurrency` hardcodes EUR / `el-GR` | §8.2 | Phase 3 |
| `nuxt.config.ts` `components.pathPrefix: false` | §5.5 | Phase 2 |
