# AGENTS.md — Instructions for AI agents working in this repository

**Authoritative.** These instructions apply to every AI agent (Claude Code, Copilot, Cursor, or any other) and to every human contributor. Where any other instruction file in this repository disagrees with this one or with `docs/ARCHITECTURE-BLUEPRINT.md`, this file and the blueprint win. Files under `.claude/` are per-machine and untracked; they may add stack conventions but never override architecture rules.

This repository is a **reusable, single-tenant starter system**: each client project is an independent clone with its own database, environment, deployment, enabled modules and branding. It is a starting point, not a shared runtime dependency.

---

## Before any code change

1. Read `docs/ARCHITECTURE-BLUEPRINT.md` (at least §2 Layers, §5 Rules summary, §11 Seams).
2. Read `docs/DEPENDENCY-RULES.md` in full.
3. Identify which layer the change belongs to: **Core**, **Module**, **Infrastructure**, or **Project**. The blueprint §2 and §10 map every current path to a layer; the target folders (`core/`, `modules/`, `infrastructure/`, `project/`) may not exist yet — the mapping still applies.
4. Do not modify production code before the owner layer is identified and the change is consistent with the rules below.
5. Work through `docs/ARCHITECTURE-CHECKLIST.md` before finishing.

If a task cannot be completed without breaking a rule, stop and say so. Do not "make it work" by adding a forbidden dependency.

---

## Dependency rules

Direction is downward only:

```text
PROJECT → OPTIONAL MODULES → CORE → INFRASTRUCTURE
```

Allowed:

```text
PROJECT → MODULE
PROJECT → CORE
MODULE  → CORE
MODULE  → INFRASTRUCTURE   (through adapters)
CORE    → INFRASTRUCTURE
```

Forbidden:

```text
CORE     → MODULE
CORE     → PROJECT
CORE     → E-commerce concepts (products, orders, cart, favourites, loyalty, shipping, inventory)
CORE     → Stripe or MinIO business logic
MODULE A → MODULE B internals
INFRASTRUCTURE → anything above it
```

"Depends on" includes imports, Prisma model access, hardcoded capability/role/setting/i18n keys, cache keys, `useState` keys, and component or store references — not just `import` statements.

---

## Module rules

- A module exposes its public surface through one `index.ts`. Other modules import only that file.
- Domain models belong to their owning module and live in that module's Prisma schema file.
- Registry contributions (capabilities, role presets, settings definitions, admin sections, navigation items, events, env fragment) are declared **inside the module**.
- Module-specific permissions, settings, navigation and admin sections must never be hardcoded in Core files. If Core lacks a slot or registry you need, propose the Core change first; do not patch a Core component.
- Modules communicate through exported services, events on the Core event bus, or explicit contracts — never by reaching into another module's files, tables or cache keys.
- E-commerce is one module (`ecommerce`) with sub-domains `catalog`, `orders`, `payments`, `loyalty`, `analytics`, `media`. Respect the sub-domain boundaries as if they were modules.

See `docs/MODULE-DEVELOPMENT-GUIDE.md` for the full contract and checklist.

---

## Frontend rules

- Use `useApi()` for every HTTP request to the backend. Do not use raw `$fetch` / `useFetch` with `apiBase` outside `useApi` itself and `plugins/auth.server.ts`; any exception carries a `// raw-fetch:` comment with the reason.
- `useApi()` must not import or mutate Pinia stores. It exposes hooks (`onUnauthenticated`); the auth plugin registers them.
- Global layouts and shells (`layouts/default.vue`, `layouts/admin.vue`, `AppHeader`, `AppFooter`, `AccountSidebar`, `account/index.vue`) must not import optional-module components, stores, composables, state keys or i18n keys. They render slots and registry lists.
- Shared state keys (`useState('…')`) are namespaced by owning layer/module and accessed through a composable.
- When Nuxt layers are introduced, every module layer sets a component prefix (`Shop*`, `Booking*`, …). Never rely on `pathPrefix: false` across layers; a name collision is a build failure, not a silent override.
- Pages declare their guard with `definePageMeta({ middleware })`. Do not add global middleware from a module.
- Stores are setup-style Pinia stores; components use `storeToRefs()`; state is mutated in actions.
- No hardcoded brand names, currency, locale lists, addresses or phone numbers in Core or module code; they come from project configuration.

---

## Configuration rules

- Secrets and host-specific values (database/Redis URLs, JWT secrets, provider API keys, storage/email/payment credentials) belong in environment variables only.
- Project identity (name, slug, locales, default locale, currency, branding, theme, enabled modules) belongs in project configuration (`project.config.ts`, once it exists; `app/utils/business.ts` + `brand.css` until then).
- Module-specific configuration belongs to the module: its Joi env fragment, its static options under the project config, its runtime-editable keys in the Settings Registry.
- Core-only boot must not require optional provider credentials (Stripe, MinIO/storage, Google OAuth). Read env only through `ConfigService`, never `process.env` at import time.

---

## Database rules

- Core owns identity (`User`, `Setting`, `NewsletterSubscriber`, `Notification`). Infrastructure owns technical records (`ProcessedEvent`). Modules own domain models (`Product`, `Category`, `Order`, `OrderItem`, `Favourite`, `LoyaltyTransaction`, …).
- Do not add domain-specific scalar fields to Core models. The last one, `User.loyaltyPoints`, was removed in seam 2 (`LoyaltyAccount` owns the balance); if the client must see module data on a user object, register a user extension (`users/user-extensions.registry.ts`) instead.
- Modules reference users by `userId` with a relation declared in the module's schema file; the Prisma back-relation on `User` is declared there too.
- Do not write another module's rows directly (`prisma.<otherModel>.create/update/delete`). Use the owner's exported service or an event.
- Migrations are one linear history. A schema-changing commit is never cherry-picked to a downstream project without its migration.
- `RefreshToken` is dead (tokens live in Redis) and is scheduled for removal; do not build on it.

---

## Implementation discipline

- Prefer incremental changes. Each change leaves the system bootable and deployable.
- Do not perform rewrites, mass file moves or folder renames without explicit approval. The blueprint defines phases; work inside the current phase.
- Do not introduce packages or frameworks without an architectural justification recorded in `docs/ARCHITECTURE-DECISIONS.md`.
- Preserve working behaviour while extracting boundaries. Keep route paths and response shapes stable unless the task says otherwise.
- When an architectural decision changes, update `docs/ARCHITECTURE-DECISIONS.md` (add a superseding record) and the blueprint summary table in the same change.
- Do not commit secrets, `.env` files, TLS keys, or generated build output.
- Run typecheck, lint and the boundary check (once they exist) before declaring a task complete. Report failures plainly.

---

## Quick reference

| Question | Answer |
|---|---|
| Where is the target architecture? | `docs/ARCHITECTURE-BLUEPRINT.md` |
| Why was X decided? | `docs/ARCHITECTURE-DECISIONS.md` (D1–D13, E-series) |
| May file A import file B? | `docs/DEPENDENCY-RULES.md` |
| How do I add a module or a module feature? | `docs/MODULE-DEVELOPMENT-GUIDE.md` |
| What do I check before finishing? | `docs/ARCHITECTURE-CHECKLIST.md` |
| What must a downstream client project do by hand? | `PETSHOPCY-MANUAL.md` |
| Stack coding conventions (Vue/Nuxt/Nest/Prisma/Stripe/Redis/MinIO)? | `.claude/CLAUDE.md` (untracked, per machine) — subordinate to this file |
