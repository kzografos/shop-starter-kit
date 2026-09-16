# Architecture Decision Records — v1 (D1–D13)

**Status:** Adopted with [ARCHITECTURE-BLUEPRINT.md](ARCHITECTURE-BLUEPRINT.md) · **Date:** 2026-09-14

Each record states the decision, why it was chosen over the alternatives the audits considered, what it prevents, and what it deliberately leaves open. A decision changes only by adding a superseding record here; the blueprint summary table is updated to match.

---

## D1 — Repository shape

**Decision.** Single repository starter system. The Nuxt app (root) and the NestJS API (`backend/`) stay as two build roots with their existing package managers (pnpm, npm). A shared **contracts** location (a plain folder, e.g. `contracts/`, referenced by relative path from both roots) holds `project.config.ts`, wire types and event names. No pnpm workspace conversion in v1.

**Why.** The audits found zero shared code between the two apps and no tooling that assumes a workspace. Converting the backend to pnpm and introducing a workspace is a mechanical but wide change with no architectural payoff until a second shared package exists. A folder both roots can import by path delivers the one thing needed now: one source for project config and wire types.

**Prevents.** Hand-mirrored types drifting (today `types/index.ts` and backend DTOs disagree on `Profile.role`); branding split across `BUSINESS` (FE source) and `BRAND_*` (BE env); a premature monorepo migration blocking Phase 1.

**Deferred.** pnpm workspace with `packages/*`; unifying package managers (revisit if the contracts folder proves awkward to type-check from both roots); publishing anything.

---

## D2 — Module packaging

**Decision.** Modules are **internal**: a folder under `backend/src/modules/<id>/` exposing one Nest module class, and a Nuxt layer under `app/modules/<id>/`. No npm packages, no separate repositories.

**Why.** There is one consumer (this repository and its clones). Packages add versioning, publishing and a second dependency graph for no benefit. Nest dynamic modules and Nuxt layers already provide isolation, composition and per-unit configuration.

**Prevents.** Version skew between a client project and "the module"; the temptation to make the starter a runtime dependency (contradicts §1 of the blueprint).

**Deferred.** Extracting a module to a package once two or more independent repositories genuinely share it unchanged.

---

## D3 — Module enable/disable

**Decision.** Enabled modules are declared in **project configuration** (`project.config.ts` → `modules: ['ecommerce', …]`). Backend `app.module.ts` composes Core plus the listed modules' Nest modules and merges their Joi env fragments. Root `nuxt.config.ts` sets `extends` to the listed layers. Disabled modules contribute nothing: no routes, no registry entries, no env requirements, no schema file in the generated client (schema files are still present in the repo; only the Nest/Nuxt composition is conditional in v1).

**Why.** Today `app.module.ts` imports all 22 modules unconditionally and the Joi schema requires Stripe and MinIO env for every boot. A static list read at composition time is the smallest mechanism that makes "optional" true, and both frameworks support it natively.

**Prevents.** Core-only boot failing on missing provider credentials; dead routes and admin sections for features a client does not have.

**Deferred.** Runtime toggling; conditional Prisma schema composition (v1 accepts that a disabled module's tables may exist empty); per-environment module lists.

---

## D4 — Role model

**Decision.** Generic **string-based roles and capabilities**. `User.role` is a plain `String` (Postgres `text`), stored **lowercase**. Core owns the mechanism (`auth/permissions.registry.service.ts`, `PermissionsGuard`, `RequirePermissions`, `permissionsFor()`) and names only two roles: `admin` (`OWNER_ROLE`, holds every capability) and `customer` (`MEMBER_ROLE`, the default, no capabilities), plus its own capabilities (`manage:staff`, `manage:settings`, `view:customers`, `manage:marketing`). Modules register additional roles as **presets** (`accountant`, `stock_manager` — owned by the e-commerce module) and capabilities (`view:catalog`, `manage:orders`, …) through the Permission Registry at module init. `permissionsFor(role)` reads the merged registry. `PermissionsGuard` semantics stay: owner bypasses, untagged admin routes are owner-only. **No database enum is reintroduced for roles**: a new module adds a role by registering a preset, never by a schema change.

**Implemented (seam 3a + 3b).** The Prisma `UserRole` enum is gone; `users.role` is `text NOT NULL DEFAULT 'customer'`. Existing values (`customer`, `admin`, `accountant`, `stock_manager`) were already lowercase in the database and were preserved verbatim; only the backend's internal vocabulary moved from Prisma enum names (`ADMIN`, …) to the stored strings. The wire format did not change (responses were already lowercase; the staff admin form's uppercase input is normalised by the DTO). Renaming `admin`/`customer` to `owner`/`member` remains a possible later, explicit contract change — not part of this decision's implementation.

**Migration contract (`20260916100000_user_role_enum_to_text`).** Hand-written, data-preserving, in this order: `DROP DEFAULT` (the default is typed as the enum) → `ALTER COLUMN role TYPE TEXT USING role::text` (each enum label becomes the identical text) → `SET DEFAULT 'customer'` → `DROP TYPE user_role`. Prisma's generated form for the same change drops and re-adds the column, which would reset every user to `customer`; it must never be regenerated. Schema, migration, generated client and role literals are one atomic change: applying the code without the migration (or the migration without the code) locks every staff account out, so this commit is **never cherry-picked partially** downstream (see the client-clone rule in `PETSHOPCY-MANUAL.md`). Rehearsed on a disposable database before merge: counts and values unchanged, no NULLs, NOT NULL and default retained, enum type gone, zero Prisma drift against the target schema.

**Why.** The Prisma `UserRole` enum mixed an end-user role with two shop staff roles and could not be extended per project without a migration. A string column plus a registry lets a booking project add `receptionist` and a CMS add `editor` with no schema change, while keeping the guard, decorator and `/profile` channel that already work.

**Prevents.** Core owning the shop's authorization vocabulary (audit seam C11/C12); per-project enum migrations; three hand-maintained copies of the role → capability map.

**Deferred.** DB-stored per-project capability overrides; per-user capability grants; hierarchical roles. Naming convention `verb:noun` with verbs `view`/`manage` is kept as-is and documented in the module guide.

---

## D5 — Content / localization

**Decision.** Two separate concerns. **UI strings** use `@nuxtjs/i18n` with locale files per layer (Core, each module, project), merged by the framework; the locale list and default come from project config. **Content localization** (translatable database fields) is **module-owned**: each module chooses and documents its strategy for its own models. E-commerce keeps column-per-locale (`name_el`, `name_en`) in v1 and introduces a `useLocalized(record, field)` helper so consumers stop inlining `locale === 'el' ? … : …`. Core imposes no content-localization scheme and has no translatable content models.

**Why.** The audit found 25 inline locale ternaries and bilingual columns fused to `Category`/`Product`. Changing the storage strategy now would touch every catalogue consumer for no v1 benefit, and the right strategy for CMS content (JSON column vs. translations table) depends on CMS requirements that do not exist yet. Making it module-owned unblocks Core extraction without pre-deciding the CMS.

**Prevents.** A Core-wide localization schema chosen before there is a second consumer; the locale set (`el`/`en`) being hardcoded in Core.

**Deferred — explicitly unresolved.** The concrete content-localization pattern for future CMS/blog/booking models, and whether `Category` can become a Core taxonomy once that pattern exists. Must be decided before the first CMS model is added.

---

## D6 — Tenancy

**Decision.** **Single tenant per independent project.** One repository clone, one database, one `.env`, one deployment, one project config per client. No `tenantId` column, no host-based tenant resolution, no shared runtime.

**Why.** Every audited mechanism (cache keys, storage buckets, cookies, Stripe credentials, branding constants) is single-tenant. The commercial audit estimated multi-tenancy at 150–250 hours of rearchitecture; the target use is a handful of independent client sites where operational isolation is a feature, not a cost.

**Prevents.** A `Store`/`Tenant` model added "just in case"; tenant dimensions leaking into cache keys and queries; shared-runtime coupling between clients.

**Deferred.** Multi-tenancy in any form. If it is ever needed it is a new blueprint version, not an amendment.

---

## D7 — Provider abstraction

**Decision.** Interfaces/adapters **only where a provider is realistically swappable**: `StorageAdapter` (MinIO/S3), `MailTransport` (Resend/SMTP — effectively exists), `PaymentProvider` (Stripe). Prisma and Redis are used directly through their existing services; no repository pattern, no cache abstraction.

**Why.** Four copies of presign logic and a Stripe SDK instantiated inside business code are real costs; a generic ORM abstraction is not. The three chosen interfaces each have one v1 implementation and a plausible second (S3, SMTP, another PSP).

**Prevents.** Modules knowing "object key vs URL"; `rawBody`/webhook handling scattered; over-engineered infrastructure layers that add indirection without a second implementation.

**Deferred.** Second implementations of any adapter; queue abstraction; an HTTP client abstraction on the backend.

---

## D8 — Event mechanism

**Decision.** A **lightweight in-process event bus** (`@nestjs/event-emitter` or an equivalent thin provider), synchronous by default, with typed event names in the Event Registry. Core emits identity events (`user.registered`, `user.authenticated`, `user.password_reset`); modules emit domain events (`order.created`, `order.paid`, `product.stock_changed`). Core subscribes to nothing from modules. No persistence, no retries, no outbox.

**Why.** The two worst Core→shop seams (auth → guest-order linking; orders → stock alerts) are direct method calls that cannot be cut without a decoupled side-effect mechanism. An in-process emitter is the smallest thing that works, and the codebase already relies on idempotent handlers (`ProcessedEvent`) and fire-and-forget side effects (`mail.send().catch()`).

**Prevents.** Core importing module services to trigger side effects; a queue dependency (and its deployment cost) before any workload needs it.

**Deferred.** Redis/BullMQ-backed events, outbox pattern, sagas, event replay. Handler failure policy beyond "log and continue" is decided during implementation (E-series).

---

## D9 — API contract

**Decision.** Frontend: **`useApi` is the single HTTP client** (owns base URL, credentials, 401 → refresh → retry; exposes an `onUnauthenticated` hook; imports no store). Backend ↔ frontend: **wire types live in the shared contracts location** (D1); response keys stay **snake_case** (the existing global interceptor), request keys stay camelCase (existing DTOs). No OpenAPI generation in v1.

**Why.** Three call conventions coexist today and the admin panel has no token refresh at all. Consolidating on `useApi` fixes that with no new tooling. Generating a client from OpenAPI would be better long-term but requires decorating every controller first; the contracts folder gets 80% of the value now.

**Prevents.** Raw `$fetch` sprawl (27 `apiBase` reads); the `useApi ↔ useAuthStore` cycle; wire types diverging silently.

**Deferred.** OpenAPI/Swagger decoration and a generated client; switching the wire format to camelCase; the interceptor's enum-lowercasing behaviour (E7) — to be replaced by DTO-level mapping when it first bites.

---

## D10 — Configuration ownership

**Decision.** Three layers: **Core config** (Core's Joi fragment: DB, Redis, JWT, app URL, CORS, owner bootstrap, mail transport), **module config** (each enabled module's Joi fragment + its static options under `project.config.modules.<id>` + its runtime-editable keys in the Settings Registry), **project config** (`project.config.ts`: identity, locales, branding, theme, contact, enabled modules). Environment variables hold **secrets and host-specific values only**. Branding never lives in env after Phase 3; `NUXT_URL` splits into `CORS_ORIGINS` and `APP_URL`.

**Why.** Today Joi validates 14 of ~31 backend variables — and the validated set is the shop's, not Core's; branding is split between FE source and BE env; one variable carries three meanings. Ownership by layer makes Core-only boot definable and gives each module a place for its own requirements.

**Prevents.** Core boot demanding Stripe/MinIO credentials; email header and site header disagreeing on the brand; unvalidated variables silently defaulting.

**Deferred.** DB-stored project config; per-environment overrides beyond `.env`; secrets management tooling.

---

## D11 — Database / schema ownership

**Decision.** **Multi-file Prisma schema** so ownership is visible in the file tree: `backend/prisma/core.prisma` (generator + datasource; Core models), `backend/prisma/infrastructure.prisma`, `backend/prisma/ecommerce.prisma`, and `backend/prisma/project.prisma` when a project needs additive models. The `backend/prisma/` folder itself is the schema root (`package.json#prisma.schema = "prisma"`; the runner image passes `--schema prisma` because it has no `package.json`), which is what keeps the shared **`backend/prisma/migrations/`** folder in place — Prisma resolves `migrations/` next to the file that holds `datasource`. A Prisma model is a single block, so the back-relation fields module models need on `User` are written inside the `User` block in `core.prisma` and annotated as module-owned; the owning side of each relation lives in the module's file. **One linear migration history** stays in `backend/prisma/migrations/`. Rule: a commit that changes a module's schema is owned by that module and is never cherry-picked downstream without its migration (see the atomicity rule in `PETSHOPCY-MANUAL.md`).

**Implemented (seam 3b step 1).** The split was a pure file reorganisation: datamodel diff empty, generated client DMMF identical apart from block order, no migration created. Note for Prisma 7: `package.json#prisma` is deprecated there in favour of `prisma.config.ts`; that switch also changes how the CLI loads `.env`, so it is a deliberate later step.

**Why.** Prisma 6.19 is installed; multi-file schema is GA. A single file hides who owns what and made `User.loyaltyPoints` look normal. Splitting migrations per module is not supported by Prisma and would break the linear history that downstream projects depend on.

**Prevents.** Core models silently acquiring module columns; ambiguity about which module a migration belongs to; downstream applying code without data changes (the PetShopCY manual already records one such outage).

**Deferred.** Conditional schema composition per enabled module (v1 tolerates empty tables for disabled modules); project-specific schema beyond additive models in `project.prisma`.

---

## D12 — Enforcement

**Decision.** Every pull request runs: frontend typecheck (`nuxi typecheck`), backend typecheck/build, frontend lint, backend lint, unit tests for critical Core behaviour, and **boundary/import validation** (`dependency-cruiser` or `eslint-plugin-boundaries`) encoding [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md). Typecheck and the boundary check must run locally before Phase 1 starts; the full pipeline lands by Phase 4.

**Why.** No typecheck, test or lint runs on either side today; four `~/types` imports are already broken and nothing noticed. A boundary that is not checked regresses within weeks.

**Prevents.** Architecture drift; a downstream inheriting latent breakage; the blueprint becoming aspirational.

**Deferred.** Coverage thresholds; E2E tests; performance budgets; release automation.

---

## D13 — Loyalty ownership and the user-extension hook

**Decision.** The loyalty balance is module data and lives in the e-commerce `loyalty` sub-domain: `LoyaltyAccount { userId @id, points, updatedAt }` (`ecommerce.prisma`, table `loyalty_accounts`, one row per user, absent row = 0). `backend/src/loyalty/loyalty.service.ts` is the **only** code that reads or writes `loyaltyAccount` and `loyaltyTransaction`; every balance change is written together with its ledger row inside the caller's transaction (`earn`/`redeem` for interactive transactions, `earnWrites` for the payment webhook's batch `$transaction([...])`, so the `ProcessedEvent`-first idempotency pattern is untouched). Earn/redeem arithmetic and the minimum-redeem rule stay with the callers (order creation, webhook, guest-order linking) — the service owns where points are stored, not how many are due.

Core does not lose the ability to show module data next to a user. **`UserExtensionsRegistry`** (`users/user-extensions.registry.ts`, provided by `UsersModule`) lets a module register `{ id, order, scopes: ('profile' | 'customers')[], extend(userIds) → Map<userId, fields> }` from its `onModuleInit`. Core applies the registered extensions at exactly the points where a user object is returned to a client — `ProfileService.me()`, `ProfileService.update()`, `AuthService.issueTokens()` (login/register/refresh), `UsersService.listCustomers()` — one query per extension per batch, never in the JWT strategy. The loyalty module contributes `loyaltyPoints` on both scopes; the orders module contributes `_count.orders` on `customers`. Core never names either module.

**Preserved contracts.** Every client-facing payload keeps every field it had: `GET /profile`, `PATCH /profile`, login/register/refresh `user`, `GET /admin/customers` (`loyalty_points`, `_count.orders`). `GET /profile/loyalty` keeps its path and response; only the owner moved (`LoyaltyController` in `loyalty/`), the `/loyalty/*` rename foreseen in the blueprint was declined as a contract change with no benefit. Redeem validation messages, earn amounts, linked-order awards (paid orders only) and webhook idempotency are byte-identical in the before/after capture. The one observable difference is JSON key order — `loyalty_points` now follows `created_at` — accepted as non-breaking. No frontend file changed.

**Migration contract (`20260917100000_loyalty_account`).** Hand-written, **single atomic step**, data-preserving: `CREATE TABLE loyalty_accounts` → FK to `users` (cascade) → `INSERT … SELECT id, loyalty_points FROM users` (every user, including zero balances) → `ALTER TABLE users DROP COLUMN loyalty_points`. Prisma runs the file in one transaction, so a failure leaves `users` intact. The blueprint's two-step (add + dual-write, then drop) was not used: `start.sh` runs `migrate deploy` before the new code boots, so there is no rolling window in which old code and new schema coexist, and a dual-write phase would only add temporary code to remove later. Schema, migration, generated client and code are one atomic change and ship together under the client-clone rule (`PETSHOPCY-MANUAL.md`). Rehearsed on a fresh `pg_dump` copy of the dev database: per-user `(id, email, points)` identical before and after, sum preserved, no NULLs, column gone, `migrate diff` reports no drift, migration history reproduces the schema exactly.

**Why.** `User.loyaltyPoints` was the last module column on a Core model and the reason Core `users.service`, `profile.service` and `auth.service` knew about loyalty at all. An extension hook is the smallest mechanism that lets Core keep returning complete user payloads without knowing which module supplies what; it is also the backend half of the "`Profile` core type with module augmentation" the frontend architecture (blueprint §10.3) assumes.

**Prevents.** Module columns creeping back onto `User` "because the profile needs them"; Core services reading shop tables; loyalty balance and ledger drifting apart (single writer, same transaction); the balance being counted twice on webhook redelivery.

**Deferred.** Renaming `GET /profile/loyalty` to `/loyalty/*` (explicit contract step, needs the frontend); per-user 1:1 tables for other module data follow this pattern when they appear; the frontend `Profile` type still declares `loyalty_points` inline until Nuxt layers split the types.

---

## Decisions intentionally left open for implementation (E-series)

Not blocking; decide when the code is touched. Listed so they are not mistaken for gaps.

| ID | Topic | Default if nobody objects |
|---|---|---|
| E1 | Permission naming | `verb:noun`, verbs `view` / `manage` |
| E2 | Registry population point | Backend: module `forRoot()`; frontend: layer `app.config.ts` |
| E3 | Admin section ordering / icon format | Numeric `order`; inline SVG name string |
| E4 | Settings value typing | `String` column + typed registry parse |
| E5 | Notification `meta` shape | `{ titleKey, bodyKey, params, link? }` |
| E6 | `media` as Core or module | Module (under e-commerce in v1, promotable) |
| E7 | Interceptor enum lowercasing | Remove the step; map in DTOs/services |
| E8 | Cache-key convention | `<module>:<entity>:<id>:<field>`; per-module `invalidate()` |
| E9 | `NUXT_URL` split | `CORS_ORIGINS` (list) + `APP_URL` (single) |
| E10 | Component prefix scheme | `Core*`, `Shop*`, `Project*` via layer `components.prefix` |
| E11 | First tests | `useApi`, `PermissionsGuard`, `AuthService` tokens, settings registry |
| E12 | CI provider | GitHub Actions |
| E13 | Health coverage | Add Redis and storage checks when the module is enabled |
| E14 | Event handler failure policy | Log and continue; handlers idempotent |
