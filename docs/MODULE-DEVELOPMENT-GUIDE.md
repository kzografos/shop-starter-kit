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

prisma/schema/<id>.prisma     # this module's models, enums, and its back-relations on Core models

app/modules/<id>/             # Nuxt layer
├── nuxt.config.ts            # components.prefix, i18n files, layer-specific config
├── app.config.ts             # navItems, headerActions, accountItems, globalWidgets, adminSections
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
- Role presets: `{ role: 'stock_manager', capabilities: ['view:catalog', 'manage:catalog', 'manage:inventory'] }`. Roles are lowercase strings stored as-is in `users.role`; adding one is a registration, never a schema change. `admin` (owner) and `customer` (member) are Core; do not redefine them.
- Guard your controllers with your own capabilities. Never guard with another module's.

### 3.3 Settings Registry contributions

```ts
{ key: 'shipping_cost', type: 'number', default: 5, public: true, group: 'ecommerce.shipping', labelKey: 'admin.settings.shipping_cost', validate: v => v >= 0 }
```

- `public: true` exposes the key on `GET /settings`; use it only for values the storefront must display (prices, thresholds). Secrets are never settings.
- Read through the Core `SettingsService` typed accessor; never `prisma.setting` directly.
- Provide defaults; the Core seed materialises them.

### 3.4 Admin Registry contributions

```ts
{ id: 'ecommerce.products', path: '/admin/products', capability: 'view:catalog', titleKey: 'admin.products', subtitleKey: 'admin.products_sub', icon: 'box', order: 20, group: 'main' }
```

- The page itself lives in the layer at `pages/admin/<section>/index.vue` with `definePageMeta({ layout: 'admin', middleware: 'admin' })`.
- Do not touch `layouts/admin.vue`, `middleware/admin.ts` or `usePermissions`. They read the registry.
- Dashboard contributions (v1): `dashboardCards[]` entries rendered by the Core dashboard page; no custom render functions.

### 3.5 Navigation slot contributions (`app.config.ts` of the layer)

- `navItems[]` — storefront header/footer links `{ to, labelKey, order }`.
- `headerActions[]` — components rendered in the header actions area (e.g. cart button) `{ component: 'ShopCartButton', order }`.
- `accountItems[]` — account sidebar links and account dashboard cards.
- `globalWidgets[]` — components mounted once in the default layout (e.g. `ShopCartDrawer`).

Component references are by registered name (prefixed), never by import path.

### 3.6 Events

- Declare emitted events in `events/index.ts`: `export const OrderPaid = defineEvent<{ orderId: string; userId: string | null; total: number }>('order.paid')`.
- Emit through the Core event bus. Subscribe to Core identity events (`user.registered`, `user.authenticated`, `user.password_reset`) and to other modules' **exported** events only.
- Handlers must be idempotent and must not throw on business failure — log and continue (E14). Anything that must be durable uses the `ProcessedEvent` pattern inside a transaction.

### 3.7 Environment

- Declare every variable you read in `<id>.env.ts` as a Joi fragment. Read them through `ConfigService` only — never `process.env` at import time (the current `AuthModule` does this and it is listed as a violation).
- Provider credentials belong to the adapter's fragment if the adapter is shared (storage), or to your module if only you use the provider (payments).

### 3.8 Schema

- Models, enums and indexes in `prisma/schema/<id>.prisma`.
- Reference users with `userId String @db.Uuid` + `user User @relation(...)`, and declare the matching back-relation on `User` in **your** file.
- Never add scalar columns to Core models. If you need per-user data, create your own 1:1 table (`LoyaltyAccount { userId @unique }`).
- Content localization is yours to choose (D5). Document it in your README. If you use column-per-locale, expose a `useLocalized()`-style accessor in your layer so consumers do not inline locale ternaries.

### 3.9 Mail

- Templates are functions in `mail/` returning `{ subject, html }`, using the Core layout helper for the branded shell.
- Send through the Core/Infrastructure `MailTransport.send({ to, subject, html })`. Do not instantiate Resend/nodemailer.

### 3.10 Storage

- Use `StorageAdapter.put()` / `resolve(refs[])` / `presign()`. Store what `put()` returns; resolve on read. Never inspect whether a stored reference is a key or a URL — that logic is the adapter's.

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

- All HTTP goes through `useApi()`. No `$fetch` with `apiBase`.
- Stores are setup-style Pinia stores; expose actions; use `storeToRefs()` in components.
- Shared state keys (`useState('<id>-…')`) are prefixed with the module id and wrapped in a composable.
- Pages that need auth use `definePageMeta({ middleware: 'auth' })`; admin pages `{ layout: 'admin', middleware: 'admin' }`. Do not add global middleware.
- Currency, locale list and formatting options come from project config through Core composables; do not hardcode `EUR` or `el-GR`.
- Do not edit Core components to add your link, button or drawer. If a slot you need does not exist, propose it as a Core change first.

---

## 6. Checklist before a module is "done"

- [ ] `index.ts` is the only export point; nothing imports deeper.
- [ ] Every capability, role preset, setting, admin section, nav item, event is declared in the module, not in Core.
- [ ] Env fragment covers every variable read; no `process.env` at import time.
- [ ] Schema file contains only this module's models; back-relations on `User` declared here.
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
| `backend/src/products`, `categories`, `favourites` | `modules/ecommerce/catalog/` | catalog |
| `backend/src/orders` + pricing keys from `settings` + `checkStock` from `notifications` + `linkGuestOrders` from `auth` | `modules/ecommerce/orders/` | orders |
| `backend/src/payments` (orchestration) | `modules/ecommerce/payments/` over `infrastructure/payments/stripe` | payments |
| `LoyaltyTransaction`, `User.loyaltyPoints`, `/profile/loyalty` | `modules/ecommerce/loyalty/` with `LoyaltyAccount` | loyalty |
| `backend/src/analytics` | `modules/ecommerce/analytics/` | analytics |
| `backend/src/uploads` + image resolution | `modules/ecommerce/media/` over `infrastructure/storage` (candidate for promotion to a shared `media` module) | media |
| `backend/src/admin/admin.service.ts` (stats, orders, products, categories) | split into the sub-domains' admin controllers | — |
| `app/stores/{cart,favourites,filters}`, `app/composables/{useProducts,useCurrency}`, `app/components/{product,cart,checkout,filters,loyalty}`, `app/components/admin/ProductDrawer.vue`, `app/pages/{products,checkout,brands}`, `app/pages/account/{orders,favourites,loyalty}`, `app/pages/admin/{index (content),analytics,products,categories,orders}`, `types/index.ts`, shop i18n namespaces | `app/modules/ecommerce/` layer | — |

The first non-shop module built against this guide (Phase 4 validation) should be small — a contact-form or blog stub — to prove that Core exposes every slot and registry a module needs.
