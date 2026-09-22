# Module Development Guide

**Status:** Adopted with [ARCHITECTURE-BLUEPRINT.md](ARCHITECTURE-BLUEPRINT.md) · **Date:** 2026-09-14
**Read first:** [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md). This guide says how to build a module that satisfies those rules. Registry shapes are illustrative; exact TypeScript types are fixed during Phase 2 (decisions E1–E5).

---

## 1. What a module is

An optional, self-contained unit of domain functionality that a project enables in `project.config.ts`. It owns its backend code, its Nuxt layer, its schema file, its i18n, its env requirements, and every registry entry it needs. Core never names it; Core learns about it only through registries.

A module is **not**: a shared runtime package, a plugin loaded at runtime, or a place to put client-specific branding.

Decide first whether the thing is a module at all:

| It is a module if… | It is not a module if… |
|---|---|
| A realistic project would not want it (shop, booking, blog) | Every project needs it (auth, users, settings mechanism) → Core |
| It has its own domain models or admin sections | It is a provider adapter (S3, SMTP, Stripe SDK) → Infrastructure |
| Two or more projects could enable it unchanged | It is one client's page or rule → Project layer |

---

## 2. Module anatomy

```text
backend/src/modules/<id>/
├── index.ts                  # PUBLIC SURFACE — the only file other modules may import
├── <id>.module.ts            # Nest module; static or forRoot(options)
├── <id>.registry.ts          # registry contributions (capabilities, roles, settings, admin sections, events)
├── <id>.env.ts               # Joi fragment for this module's environment variables
├── <sub-domain>/             # optional internal sub-domains, each with its own index.ts
│   ├── <name>.controller.ts
│   ├── <name>.service.ts
│   └── dto/
├── events/                   # event names + payload types this module emits
├── mail/                     # template functions (return { subject, html })
└── README.md                 # what it does, what it contributes, what env it needs

backend/prisma/<id>.prisma    # this module's models and enums (today: ecommerce.prisma); the prisma/ folder is the schema root

app/modules/<id>/             # Nuxt layer
├── nuxt.config.ts            # components.prefix, i18n files, layer-specific config
├── app.config.ts             # navItems, headerActions, globalWidgets, accountItems, accountCards, adminSections
├── components/
├── composables/
├── stores/
├── pages/                    # storefront pages + admin pages under pages/admin/<section>/
├── types/                    # wire types (or references into contracts/)
├── i18n/{el,en}.json         # namespaces owned by this module only
└── plugins/                  # only if unavoidable; prefer composables
```

Conventions:

- `<id>` is lowercase kebab (`ecommerce`, `booking`). Sub-domains likewise (`catalog`, `orders`).
- Component prefix is the module's PascalCase id (`Shop`, `Booking`) — set in the layer's `nuxt.config.ts`; never `pathPrefix: false`.
- i18n namespaces start with the module id or a domain noun the module owns (`products.*`, `checkout.*`, `booking.*`). Never write into `common.*`, `auth.*`, `admin.*` shell keys.
- Cache keys: `<id>:<entity>:<key>:<field>`. Expose `invalidate()` per entity.

---

## 3. The module contract (what you declare)

Everything below lives inside the module. Core reads it; Core is never edited to add a module.

### 3.1 Module Registry entry

```ts
// backend/src/modules/<id>/index.ts (shape illustrative)
export const module = defineModule({
  id: 'ecommerce',
  nest: EcommerceModule,           // Nest module class
  env: ecommerceEnvSchema,         // Joi fragment, merged only when enabled
  registry: ecommerceRegistry,     // capabilities, roles, settings, admin sections, events
})
```

Frontend side: the layer path (`app/modules/<id>`) is added to `extends` by the root config when the id appears in `project.config.modules`.

### 3.2 Permission Registry contributions

- Capabilities: `{ id: 'view:catalog', descriptionKey: 'ecommerce.caps.view_catalog' }`. Naming `verb:noun`, verbs `view` | `manage`. Ids are global; a duplicate across modules fails boot.
- Role presets: `{ role: 'stock_manager', capabilities: ['view:catalog', 'manage:catalog', 'manage:inventory', 'view:notifications', 'manage:media'] }`. Roles are lowercase strings stored as-is in `users.role`; adding one is a registration, never a schema change. `admin` (owner) and `customer` (member) are Core; do not redefine them. A preset may include Core capabilities (here the admin inbox and image upload) so the role gets the Core surfaces it needs; `accountant` carries none of them.
- Register capabilities from the sub-domain that owns them (`<sub-domain>-permissions.ts`, one `order` value per registrar) and role presets from the module **root** registrar (`modules/ecommerce/ecommerce-permissions.ts` → `EcommercePermissions`, provided by `ecommerce.module.ts`): a preset spans several sub-domains' capabilities, so it belongs to the module as a whole. The registry validates preset → capability references at bootstrap; registration order never changes outputs.
- Guard your controllers with your own capabilities. Never guard with another module's. Core controllers are guarded only by Core capabilities (`view:notifications`, `manage:media`, …) — if a Core endpoint should be reachable by your role, add the Core capability to your preset rather than re-guarding the endpoint.

### 3.3 Settings Registry contributions (implemented — see `docs/SETTINGS-REGISTRY.md`)

```ts
// <module>/my-settings.ts — the only place the setting is described
export const MY_GROUPS: readonly SettingGroupDefinition[] = [{ id: 'fulfilment', labelKey: 'admin.fulfilment_settings', icon: 'box', order: 30 }]
export const MY_SETTINGS: readonly SettingDefinition[] = [
  { key: 'pickup_lead_hours', type: 'number', default: '2', group: 'fulfilment', labelKey: 'admin.pickup_lead_hours', order: 10, min: 0, step: 1, public: true },
]
// a provider's onModuleInit: this.settings.defineGroups(MY_GROUPS); this.settings.define(MY_SETTINGS)
```

- `public: true` exposes the key on `GET /settings`; use it only for values the storefront must display (prices, thresholds). Secrets are never settings.
- `default` is the one authoritative default: `SettingsService.getAll()` applies it when no row exists, so nothing is seeded. Never overwrite a stored row.
- `min`/`max`/`editable`/`type` are enforced by Core on `PATCH /admin/settings`; the admin form renders the card and fields from the definition (label/hint i18n keys, unit, min/step) — do not touch `app/pages/admin/settings/index.vue`.
- Read through the Core `SettingsService` (`getAll()`), or your own typed view like `PricingSettingsService.loadPricing()`; never `prisma.setting` directly.

### 3.4 Admin Registry contributions (`app.config.ts`, implemented — see `docs/ADMIN-REGISTRY.md`)

```ts
adminSections: [
  { id: 'products', path: '/admin/products', labelKey: 'admin.products', subtitleKey: 'admin.subtitle_products', icon: 'box', capability: 'view:catalog', order: 20, group: 'main' },
] satisfies AdminSectionContribution[]
```

- The page itself lives in the layer at `pages/admin/<section>/index.vue` with `definePageMeta({ layout: 'admin', middleware: 'admin' })`; its API routes carry the same capability in `RequirePermissions` (the registry only controls visibility).
- `icon` names an entry of `components/admin/AdminIcon.vue` (`dashboard`, `chart`, `box`, `tag`, `cart`, `bell`, `users`, `mail`, `staff`, `settings`); an unknown name renders a fallback glyph — add the glyph to the Core set if you need a new one.
- Do not touch `layouts/admin.vue`, `middleware/admin.ts` or `usePermissions`. They read the registry.
- Dashboard tiles are still deferred (blueprint §7.2).

### 3.5 Navigation slot contributions (`app.config.ts` of the layer)

Implemented in seam 9; contracts in `app/types/contributions.ts`. The Core shells (`AppHeader`, `layouts/default.vue`, `AccountSidebar`, `pages/account/index.vue`) read these lists with `useAppConfig()`, sort each by `order` and render them; they never import a module. Until layers exist the entries live in the root `app/app.config.ts`; they move into your layer's `app.config.ts` unchanged (Nuxt concatenates the arrays across layers).

- `navItems[]` — storefront header links `{ to, labelKey, order }`. `to` is unlocalised; the shell applies `localePath()`.
- `headerActions[]` — components rendered in the header `{ component, order, area? }`. `area: 'actions'` (default) is the right-hand action cluster (e.g. `CartButton`); `area: 'center'` is the flexible desktop zone between the nav and the actions (e.g. `HeaderSearch`). The component owns its own wrapper and any route-based `v-if`.
- `globalWidgets[]` — components mounted once in the default layout `{ component, order }` (e.g. `CartDrawer`).
- `accountItems[]` — account sidebar links `{ to, icon, labelKey, order }`, rendered after the Core dashboard link.
- `accountCards[]` — dashboard blocks rendered below the welcome header `{ component, order }` (e.g. `LoyaltyCard`, `AccountStats`).

Declare each list with `satisfies <Contract>[]` so a wrong entry fails type-checking at the source.

**`.global.vue` convention.** `component` is a **registered component name**, never an import path; the shells render it with `<component :is="name">`, which resolves only globally registered components. A contributed shell component must therefore carry the `.global.vue` suffix (`CartButton.global.vue` → name `CartButton`): Nuxt registers such files globally, as lazy chunks, with no `nuxt.config` change. The suffix is not part of the name, and the name still follows the layer's component prefix rule once prefixes exist (`ShopCartButton.global.vue`). Components that are only used by tag inside your own layer do not need the suffix.

### 3.6 Events

- Declare emitted events in `events/index.ts`: `export const OrderPaid = defineEvent<{ orderId: string; userId: string | null; total: number }>('order.paid')`.
- Emit through the Core event bus. Subscribe to Core identity events (`user.registered`, `user.authenticated`, `user.password_reset`) and to other modules' **exported** events only.
- Handlers must be idempotent and must not throw on business failure — log and continue (E14). Anything that must be durable uses the `ProcessedEvent` pattern inside a transaction.

### 3.7 Environment

- Declare every variable you read in `<id>.env.ts` as a Joi fragment. Read them through `ConfigService` only — never `process.env` at import time (the current `AuthModule` does this and it is listed as a violation).
- Provider credentials belong to the adapter's fragment if the adapter is shared (storage), or to your module if only you use the provider (payments).

### 3.8 Schema

- Models, enums and indexes in `backend/prisma/<id>.prisma`, beside `core.prisma`, `infrastructure.prisma` and the shared `migrations/` folder. The `prisma/` folder is the schema root (`package.json#prisma.schema`, `start.sh --schema prisma`); every `*.prisma` file in it is one schema, and only `core.prisma` carries the `generator`/`datasource` blocks.
- Reference users with `userId String @db.Uuid` + `user User @relation(...)` in your file. Prisma keeps a model in **one block**, so the matching back-relation field on `User` (e.g. `orders Order[]`) is written inside the `User` block in `core.prisma`, annotated there as owned by your module; the owning side of the relation stays in your file.
- Never add scalar columns to Core models. If you need per-user data, create your own 1:1 table (`LoyaltyAccount { userId @id }` is the reference implementation) and, if the client must see it on the user object, register a user extension (§3.8a).
- Content localization is yours to choose (D5). Document it in your README. If you use column-per-locale, expose a `useLocalized()`-style accessor in your layer so consumers do not inline locale ternaries.

### 3.8a User extensions (fields on user payloads)

Implemented in seam 2 (`backend/src/core/users/user-extensions.registry.ts`). When your module owns per-user data that the client expects to see *on the user object* — the loyalty balance is the model case — do not add a column to `User` and do not make Core read your table. Register a user extension from your module's `onModuleInit`:

```ts
this.registry.define({
  id: 'loyalty',                    // unique; duplicate id fails boot
  order: 10,                        // position of your fields in the merged object
  scopes: ['profile', 'customers'], // 'profile' = /profile + login/register/refresh; 'customers' = /admin/customers
  extend: async (userIds) => new Map(userIds.map((id) => [id, { loyaltyPoints: 0 /* … */ }])),
})
```

- `extend()` receives every user id in the batch and returns fields per id in **one** query; return an entry for every id so the payload shape never depends on the data (`{ loyaltyPoints: 0 }` for a user without a row).
- Core applies extensions only where a user object is returned to a client, never per request in the JWT strategy — keep `extend()` cheap.
- Field names are camelCase; the Core interceptor snake-cases them on the wire (`loyaltyPoints` → `loyalty_points`).
- Do not use an extension to smuggle behaviour into Core (no writes, no side effects); it is a read-only projection.
- **Reading it on the frontend:** Core's `Profile` type carries extensions as `[extension: string]: unknown` and names none of them. Declare your field's type next to your module's types (`LoyaltyProfileExtension { loyalty_points: number }`) and read it through a module composable (`useLoyalty()` → `loyaltyPointsOf(profile)`, `app/utils/loyalty.ts`), never by adding a computed to the Core auth store.
- Role values Core writes (`OWNER_ROLE`, `MEMBER_ROLE`) live in `backend/src/core/users/roles.ts`; import them from there in `core/users/`, and from `core/auth/permissions` (which re-exports them) elsewhere. `core/users` never imports `core/auth` at runtime — boundary rule E.

### 3.9 Mail

- Templates are functions in your module (e.g. `orders/order-confirmation.mail.ts`) returning `{ subject, html }`, sent through `MailService.sendMail()` (`backend/src/infrastructure/mail/`), using its layout helper for the branded shell.
- Send through the Core/Infrastructure `MailTransport.send({ to, subject, html })`. Do not instantiate Resend/nodemailer.

### 3.10 Storage

- Use `StorageAdapter.put()` / `resolve(refs[], expiry?)` / `presign(key, expiry)` / `remove(key)` (`backend/src/infrastructure/storage/storage-adapter.ts`, injected by the abstract class). Store what `put()` returns; resolve on read. Never inspect whether a stored reference is a key or a URL — that logic is the adapter's. Uploads themselves go through Core's `POST /uploads/image` (`manage:media`); add that capability to your preset if your staff role uploads images. `remove(key)` takes an object key only: the caller decides whether a reference is its own to delete (see §3.10a).

### 3.10a Product images (reference implementation)

The e-commerce module's product images are the worked example of a module owning per-entity media over the storage adapter (`backend/src/modules/ecommerce/products/products.service.ts`, `products-admin.controller.ts`, `dto/product-images.dto.ts`; admin UI in `app/components/admin/ProductDrawer.vue`).

- **`Product.images String[]` is the single source of truth.** There is no image table. The array order is the display order and `images[0]` is the primary image — every storefront, cart and order view reads it that way. A reference is either an object key returned by `StorageAdapter.put()` or an absolute `http(s)` URL (seeded or imported); a product may not hold the same reference twice (`ArrayUnique` on every write, including the product upsert).
- **Endpoints** (`/admin/products/:id/images`, guards `JwtAuthGuard` + `PermissionsGuard`; each returns the updated `{ images, image_urls }` and invalidates the product caches; unknown product → 404 `Product not found`):
  - `POST /admin/products/:id/images` — multipart `file`, validated by the Core upload path (size, magic bytes, MIME), stored with `put()` and appended. Requires `manage:catalog` **and** `manage:media`. Unconfigured storage → 503 before any write.
  - `PATCH /admin/products/:id/images/order` — body `{ images: string[] }`: **exactly the product's current references**, in the new order (`images[0]` becomes the primary). Missing, extra or duplicate references → 400. Requires `manage:catalog`.
  - `DELETE /admin/products/:id/images/:ref` — detaches one reference. `:ref` is a storage key or an absolute URL; the client sends it through **`encodeURIComponent`** and the router decodes it once (keys contain no `%`, so there is no second decode). Reference not on the product → 404 `Image not found on this product`. Requires `manage:catalog` **and** `manage:media`.
- **Storage cleanup is best-effort and never fails the row update.** After a detach — and after a product update that drops references — a key is passed to `StorageAdapter.remove()` only when it is not an absolute URL and no product still references it (`images has key` count = 0). Absolute URLs are removed from the array but never deleted from storage. A storage error, or storage not being configured, is logged and swallowed: the database is the source of truth and the product has already been saved.
- **Admin drawer.** Editing an existing product uses the three endpoints and shows exactly the order the API returns; removal asks for confirmation; one image request runs at a time. Creating a product has no id yet, so its images stay local (`POST /uploads/image` for the files, local reorder/remove) until `POST /admin/products` persists the array.

### 3.10b Order lifecycle (reference implementation)

The e-commerce orders sub-domain is the worked example of a module owning a state machine with side effects across the storage of stock, a ledger (loyalty) and a provider webhook (`backend/src/modules/ecommerce/orders/order-status.ts`, `orders.service.ts`, `backend/src/modules/ecommerce/payments/payments.service.ts`, `backend/src/infrastructure/payments-provider/`).

**Transitions.** `Order.status` only moves forward:

| From | Allowed next |
|---|---|
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `PROCESSING`, `CANCELLED` |
| `PROCESSING` | `READY`, `CANCELLED` |
| `READY` | `COMPLETED`, `CANCELLED` |
| `COMPLETED` | — (final) |
| `CANCELLED` | — (final) |

`OrdersService.updateStatus()` (`PATCH /admin/orders/:id/status`, `manage:orders`) rejects anything else — going back, repeating the current status, leaving a final status — with 400 `Cannot change status from <current> to <requested>`; an unknown order is 404. The admin list returns `allowed_statuses` per row so the admin UI offers exactly those transitions and disables final orders. The table is the single source: nothing else decides what a status may become.

**Cancellation** is one method, `OrdersService.cancel(id, reason?)`, reached from `updateStatus('cancelled')` and from the payment webhook. Inside a single transaction it re-checks the table, moves the order to `CANCELLED` with an update **conditional on the status it just read**, puts every line's quantity back into `Product.stock`, and for a customer order calls `LoyaltyService.reverseForOrder()`. Afterwards it invalidates the product and analytics caches and runs `StockAlertsService.checkStock()` on the restocked products (an open low-stock alert resolves once the shelf is full again). Those post-commit effects run through `afterCommit()` (`backend/src/infrastructure/common/utils/after-commit.ts`): never awaited, never able to fail the committed cancellation, and every failure logged as `<label> failed after commit` by the service — the policy for any detached work a module runs after its own transaction (EVENT-REGISTRY §1.5). The `reason` is logged, not stored.

- *Restock* applies to every order, guest or customer; a line whose product was deleted is skipped.
- *Loyalty reversal* uses only the existing ledger types: the order's net `EARN` is taken back as a negative `EARN` row and its net `REDEEM` returned as a positive `REDEEM` row, each with the matching balance change. It works from the ledger's own net, so an order that never earned or redeemed, or one already reversed, writes nothing. The balance may go negative if the customer already spent points the order earned — consistent with the ledger, deliberately not blocked.
- *Idempotency* is the status transition: a repeated or concurrent cancellation finds `CANCELLED` (or loses the conditional update) and is rejected — 400, or 409 on the race — without restocking or reversing twice.
- Payment is **not** touched: there is no automatic refund. Cancelling a paid order is an operator decision and the refund is a manual Stripe action; the webhook logs "refund manually" if a payment lands on a cancelled order.

**Abandoned online checkouts.** A Stripe order reserves its stock when placed. Stripe expires an unpaid Checkout Session after 24 hours (its default) and sends `checkout.session.expired`; there is no cron or scheduler — release depends on that webhook, so the Stripe Dashboard endpoint (`POST /payments/webhook`, same `STRIPE_WEBHOOK_SECRET`) must be subscribed to **both** `checkout.session.completed` and `checkout.session.expired` (README, *Required webhook events*). The layering:

1. `StripePaymentProvider.parseWebhook()` verifies the signature and turns the event into the neutral `WebhookEvent` — `checkoutCompleted { orderId, userId, amountTotalMinor, paymentIntentId }` or `checkoutExpired { orderId }` from the session's `order_id` metadata. The provider never touches the database.
2. `PaymentsService.handleWebhook()` decides: a completed checkout settles the order (ProcessedEvent-first transaction, loyalty award); an expired checkout releases it by calling `OrdersService.cancel()`.
3. `OrdersService.cancel()` owns the side effects, as above.

What `checkout.session.expired` does, by order state:

| Order when the event arrives | Effect |
|---|---|
| `PENDING`, unpaid, Stripe | cancelled through `cancel()`: stock back, loyalty reversed if any, `ProcessedEvent` recorded afterwards |
| paid (`PAID`, or status beyond `PENDING`) | ignored, acknowledged (`received: true`) — nothing is resurrected or refunded |
| already `CANCELLED` (admin, or an earlier delivery) | ignored, acknowledged; no second restock |
| not a Stripe order, unknown order, no `order_id` | ignored, acknowledged |
| duplicate delivery (same event id) | `ProcessedEvent` hit → ignored |
| concurrent deliveries / admin cancel racing the event | the status-conditional update lets exactly one win; the others are acknowledged as no-ops |
| `checkout.session.completed` arriving **after** the order was cancelled | acknowledged, not settled; logged as a manual refund case |

For the expired event the idempotency guard is the status transition and the `ProcessedEvent` row is written **after** the release, so a crash in between leaves the order cancelled and the retry a no-op; the completed event keeps its ProcessedEvent-first transaction because settlement (payment status, loyalty award) is not status-idempotent on its own.

Not implemented, by decision: customer self-cancellation (no endpoint or UI), automatic refunds, a scheduler for expiry, status-change emails.

---

## 4. Public surface rules

`index.ts` exports only what other modules may use: services meant for consumption, event definitions, DTO/interface types, the module definition. Internal services, controllers, DTO classes with validation decorators and helpers are not exported.

Other modules import from `@modules/<id>` (or the relative `index.ts`) and nothing deeper. The boundary check enforces this (DEPENDENCY-RULES §4, §10).

If module B needs data owned by module A:

1. Ask A for an exported read service; or
2. Subscribe to A's event and keep a local projection; or
3. Write an explicit contract (interface in A's index, implemented by A).

Never `prisma.<A's model>` from B. Never write A's rows.

---

## 5. Frontend rules inside a module

- All HTTP goes through `useApi()` — `const api = useApi()` in setup, then `api<T>('/path', opts)`; no `$fetch` with `apiBase`. Conventions, error handling and the single allowed exception: `docs/USEAPI-MIGRATION.md`.
- Stores are setup-style Pinia stores; expose actions; use `storeToRefs()` in components.
- Shared state keys (`useState('<id>-…')`) are prefixed with the module id and wrapped in a composable.
- Pages that need auth use `definePageMeta({ middleware: 'auth' })`; admin pages `{ layout: 'admin', middleware: 'admin' }`. Do not add global middleware.
- Currency, locale list and formatting options come from project config through Core composables; do not hardcode `EUR` or `el-GR`.
- Do not edit Core components to add your link, button or drawer. If a slot you need does not exist, propose it as a Core change first.
- **Notification wording is a contribution.** Core's bell, panel and history page render every row through `describeNotification()` (`app/utils/notification-presenters.ts`); a type nobody registered gets the generic line. If your module writes notification rows, register a presenter from a universal plugin in your layer:

```ts
// plugins/<module>-notifications.ts
import { registerNotificationPresenter } from '~/utils/notification-presenters'
export default defineNuxtPlugin(() => {
  registerNotificationPresenter('order_status', (row, { t, localePath }) => ({ title: t('…'), body: t('…'), to: localePath('/account/orders/' + row.meta?.order_id) }))
})
```

  The presenter owns its `meta` shape and its i18n keys; it must not throw (a throw falls back to the generic line, so it would silently lose your wording). Reference: `app/utils/order-notification-presenter.ts`.

---

## 6. Checklist before a module is "done"

- [ ] `index.ts` is the only export point; nothing imports deeper.
- [ ] Every capability, role preset, setting, admin section, nav item, user extension, event is declared in the module, not in Core.
- [ ] Env fragment covers every variable read; no `process.env` at import time.
- [ ] Schema file contains only this module's models and enums; any back-relation field your models need on `User` is added to the `User` block in `core.prisma` with a comment naming this module as its owner — no scalar columns on Core models.
- [ ] No Prisma access to models outside this file except through Core/module services.
- [ ] Cache keys namespaced; `invalidate()` exported; no `delPattern` on foreign namespaces.
- [ ] No hardcoded brand, currency, locale or address.
- [ ] Component prefix set; i18n namespaces owned; no writes to Core namespaces.
- [ ] `README.md` lists: purpose, contributions, env, events emitted/consumed, schema, localization strategy.
- [ ] Boundary check, typecheck, lint pass; at least one unit test per exported service.
- [ ] Disabling the module in `project.config.ts` boots the system with no error and no dangling route or nav item.

---

## 7. Worked mapping: the e-commerce module (current code → target)

| Current path | Target | Sub-domain |
|---|---|---|
| ~~`backend/src/products`, `categories`, `favourites`~~ → `backend/src/modules/ecommerce/{products,categories,favourites}` — **moved (E3a)**, kept flat by decision; no `catalog/` grouping | `modules/ecommerce/{products,categories,favourites}/` | catalog |
| ~~`backend/src/orders`~~ → `backend/src/modules/ecommerce/orders` — **moved (E3a)**; pricing keys, `checkStock`, `linkGuestOrders` already extracted (seams 1/4/5b) | `modules/ecommerce/orders/` | orders |
| ~~`backend/src/payments`~~ → `backend/src/modules/ecommerce/payments` — **moved (E3a)**; `infrastructure/payments-provider/` (E2) | `modules/ecommerce/payments/` over `infrastructure/payments-provider/` | payments |
| ~~`backend/src/loyalty`~~ → `backend/src/modules/ecommerce/loyalty` — **moved (E3a)** (`LoyaltyAccount`, `LoyaltyTransaction`, `GET /profile/loyalty`, `loyaltyPoints` user extension — seam 2) | `modules/ecommerce/loyalty/` | loyalty |
| ~~`backend/src/analytics`~~ → `backend/src/modules/ecommerce/analytics` — **moved (E3a)** | `modules/ecommerce/analytics/` | analytics |
| `backend/src/core/uploads` (Core, `manage:media` — seam 7 step 2) over `infrastructure/storage/` (`StorageAdapter` — seam 7 step 1, E2) | **stays Core** (decision, E3 recon 2026-09-22): generic image upload is a Core capability; no `modules/ecommerce/media/` | media (Core) |
| `backend/src/admin/admin.service.ts` (stats, orders, products, categories) | split into the sub-domains' admin controllers | — |
| `app/stores/{cart,favourites,filters}`, `app/composables/{useProducts,useCurrency}`, `app/components/{product,cart,checkout,filters,loyalty}`, `app/components/admin/ProductDrawer.vue`, `app/pages/{products,checkout,brands}`, `app/pages/account/{orders,favourites,loyalty}`, `app/pages/admin/{index (content),analytics,products,categories,orders}`, `types/index.ts`, shop i18n namespaces | `app/modules/ecommerce/` layer | — |

The first non-shop module built against this guide (Phase 4 validation) should be small — a contact-form or blog stub — to prove that Core exposes every slot and registry a module needs.
