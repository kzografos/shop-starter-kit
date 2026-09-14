# Dependency Rules

**Status:** Adopted with [ARCHITECTURE-BLUEPRINT.md](ARCHITECTURE-BLUEPRINT.md) · **Date:** 2026-09-14
**Audience:** every contributor and every AI agent working in this repository or a project derived from it.

These rules are written to be checked by a tool (D12). Until the tool exists, they are checked in review. A pull request that breaks one of them is not mergeable, regardless of whether it "works".

---

## 1. Layers

```text
PROJECT          app/project/**        backend/src/project/**        contracts/project.config.ts
OPTIONAL MODULE  app/modules/<id>/**   backend/src/modules/<id>/**   prisma/schema/<id>.prisma
CORE             app/core/**           backend/src/core/**           prisma/schema/core.prisma
INFRASTRUCTURE   —                     backend/src/infrastructure/** prisma/schema/infrastructure.prisma, docker/, compose files
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
3. **`useApi` is the only standard HTTP entry point.** Raw `$fetch` / `useFetch` / `$fetch.raw` against the API is allowed only:
   - inside `useApi` itself;
   - inside the SSR auth plugin (`plugins/auth.server.ts`) where request headers must be forwarded;
   - with an inline comment starting `// raw-fetch:` stating the reason, reviewed case by case.
4. **`useApi` must not import or mutate Pinia stores.** It exposes hooks (`onUnauthenticated`, later `onError`) that the auth plugin registers. Store reads/writes happen in stores and plugins, never in the client.
5. **Component naming:** when Nuxt layers are introduced, each layer sets a component prefix (`Core*`, `Shop*`, `Project*`) or `pathPrefix: true`. Two layers may not register the same component name. A collision is a build failure, not a silent override.
6. **Shared state keys** (`useState('<key>')`) are owned by the layer that defines them and are accessed only through a composable exported by that layer.
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

1. Core models (`User`, `Setting`, `NewsletterSubscriber`, `Notification`) carry no module-specific scalar columns. Module back-relations on `User` are declared in the module's schema file.
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

| Rule | Tool | Status |
|---|---|---|
| §2–§3 import direction | `dependency-cruiser` (both roots) or `eslint-plugin-boundaries` | Phase 0 definition · Phase 1 local · Phase 4 CI |
| §4 internals import | same tool: `modules/<a>/**` → `modules/<b>/**` allowed only for `modules/<b>/index.ts` | same |
| §5.3–§5.4 `useApi` | ESLint `no-restricted-syntax` on `$fetch(` / `useFetch(` outside allow-listed files; `no-restricted-imports` of `~/stores/*` in `useApi.ts` | Phase 1 |
| §5.5 component collisions | Nuxt build with per-layer prefix; a duplicate-name check script | Phase 2 |
| §6.1 Core guards | grep/lint: `RequirePermissions('manage:(inventory|catalog|orders|marketing)')` outside `modules/**` | Phase 1 |
| §6.4 Prisma access | `dependency-cruiser` cannot see model access; a grep-based script over `prisma\.<model>` per folder | Phase 1 |
| §6.6 cache namespaces | grep-based script over `delPattern('` / `redis.del('` per folder | Phase 2 |
| §7.1 Core columns | review + schema-file ownership (`core.prisma` diff reviewed by Core owner) | Phase 1 |
| Typecheck / lint / tests | `nuxi typecheck`, `tsc --noEmit`, `eslint`, Vitest, Jest | Phase 1 local · Phase 4 CI |

> Architecture rules are not complete until they are enforceable automatically.

---

## 11. Current known violations (to be removed, not to be copied)

Listed so that nobody treats them as precedent. Locations are current paths.

| Violation | Rule | Removal |
|---|---|---|
| `backend/src/auth/auth.service.ts` `linkGuestOrders()` touches `order`, `loyaltyTransaction`, `setting` | §3, §6.4 | Blueprint seam 1 |
| `backend/src/users/users.service.ts` selects `loyaltyPoints` | §7.1 | seam 2 |
| `backend/src/profile/*` exposes `GET /profile/loyalty` | §3 | seam 2 |
| `backend/src/auth/permissions.ts` defines shop capabilities and roles; `UserRole` enum | §3 | seam 3 |
| `backend/src/settings/settings.service.ts` `PRICING_SETTING_KEYS`; `GET /settings` returns pricing only | §3, §8.3 | seam 4 |
| `backend/src/notifications/*` `checkStock`, `NotificationType`, `manage:inventory` guard | §3, §6.1 | seam 5 |
| `backend/src/uploads/uploads.controller.ts` guarded by `manage:catalog` | §6.1 | seam 7 |
| `backend/src/mail/mail.service.ts` `sendOrderConfirmation` | §3 | seam 5 |
| `backend/src/common/interceptors/snake-case.interceptor.ts` `ENUM_FIELDS` names order enums | §3 | E7 |
| `backend/src/app.module.ts` Joi requires `STRIPE_*`, `MINIO_*` | §6.2 | Phase 1 |
| `backend/src/admin/admin.service.ts` mixes users/newsletter/settings with shop | §3, §4 | seam 10 |
| `backend/src/admin/admin.service.ts`, `orders.service.ts` delete other namespaces' cache keys | §4, §6.6 | seam 8 |
| `backend/src/products/products.service.ts` duplicates `isExternalUrl` / presign loop | §2 (adapter use) | seam 7 |
| `app/layouts/default.vue` mounts `CartDrawer` | §5.1 | seam 9 |
| `app/components/layout/AppHeader.vue` imports cart/filters stores, `cart-open` state, shop nav | §5.1, §5.6, §5.8 | seam 9 |
| `app/components/account/AccountSidebar.vue`, `app/pages/account/index.vue` hardcode shop routes and `loyalty.*` keys | §5.1, §5.8 | seam 9 |
| `app/composables/usePermissions.ts` `SECTION_CAPS` / `LANDING_ORDER`; `app/layouts/admin.vue` nav buttons | §5.2 | Phase 2 Admin Registry |
| `app/composables/useApi.ts` writes `useAuthStore().profile` | §5.4 | Phase 1 |
| 27 files read `apiBase`; every admin page uses raw `$fetch` | §5.3 | Phase 1 |
| `app/composables/useBusinessSchema.ts` hardcodes `Store`, `priceRange`, `currenciesAccepted`; `useCurrency` hardcodes EUR / `el-GR` | §8.2 | Phase 3 |
| `nuxt.config.ts` `components.pathPrefix: false` | §5.5 | Phase 2 |
