# Admin Registry

Phase 2, first registry. The admin shell (`layouts/admin.vue`, `middleware/admin.ts`, `usePermissions`) renders and gates admin sections from a typed list in `app.config` and no longer names any section, path or capability itself.

## Problem

Until this change the Core admin shell carried the shop's admin map by hand: `layouts/admin.vue` had one `<button v-if="can('view:catalog')" @click="navigateTo('/admin/products')">` per section (with its icon and an `isProducts`-style computed for the active state, and an English title/subtitle table), and `usePermissions.ts` repeated the path → capability map (`SECTION_CAPS`) and the landing order (`LANDING_ORDER`) plus the shop's staff-role names (`STAFF_ROLES`). Adding, removing or renaming a shop section meant editing three Core files. It was the last Core → Shop coupling left in the repository (ARCHITECTURE-AUDIT §2.3).

## Contract

[`app/types/contributions.ts`](../app/types/contributions.ts):

```ts
interface AdminSectionContribution {
  id: string                 // stable, unique: 'products', 'staff', …
  path: string               // unlocalised, must start with /admin
  labelKey: string           // i18n key: sidebar label and page title
  subtitleKey?: string       // i18n key: topbar subtitle (missing key → empty)
  icon: string               // name in the shell's icon set; unknown → fallback glyph
  capability: string         // visibility rule; the backend guard is the authority
  order: number              // sort key inside the group; also the landing preference
  group?: string             // adminGroups id; unknown/absent → first group
  activeMatch?: 'exact' | 'prefix'  // 'exact' for the dashboard; default 'prefix'
  badgeStateKey?: string     // useState<number> key rendered as a counter badge
  enabled?: boolean          // false removes the entry without deleting it
}
interface AdminGroupContribution { id: string; order: number; labelKey?: string }
```

Kept out on purpose: render functions, nested sections, per-entry components, an `enabled` predicate (functions in `app.config` would not survive a future serialisation of the config), dashboard tiles.

## Registration strategy

**Static typed lists in `app.config.ts`** (`adminGroups`, `adminSections`), the same mechanism seam 9 introduced for `navItems`, `headerActions`, `globalWidgets`, `accountItems`, `accountCards`. Chosen because:

- it already exists and every shell reads it the same way (`useAppConfig()` + sort by `order`);
- entries are checked at compile time (`satisfies AdminSectionContribution[]`);
- Nuxt merges `app.config` across layers, so when the e-commerce layer arrives its entries move into `app/modules/ecommerce/app.config.ts` with no shell change;
- no runtime imports, no discovery, no plugin framework (blueprint §7.3, §14.2).

Today all entries live in the root [`app/app.config.ts`](../app/app.config.ts), split by a comment into the e-commerce block (dashboard, analytics, products, categories, orders) and the Core block (notifications, customers, newsletter, staff, settings).

## Ownership

| Piece | Owner | Role |
|---|---|---|
| `app/types/contributions.ts` | Core | contract |
| `app/utils/admin-registry.ts` | Core | pure helpers: validate, filter by capability, group, match a route, landing path |
| `app/composables/useAdminRegistry.ts` | Core | registry + permissions + route, for the shell |
| `app/composables/usePermissions.ts` | Core | `can()`, `isStaff`, `requiredCapFor(path)` and `firstAllowedPath()` — the last two read the registry |
| `app/components/admin/AdminIcon.vue` | Core | icon set; modules reference icons by name |
| `app/layouts/admin.vue`, `app/middleware/admin.ts` | Core | consumers only |
| `app/app.config.ts` `adminSections` / `adminGroups` | each module (and Core for its own sections) | contributions |
| `app/pages/admin/<section>/index.vue` | the contributing module | the page (`definePageMeta({ layout: 'admin', middleware: 'admin' })`) |
| backend `RequirePermissions(...)` on `/admin/*` routes | the contributing module | **authorization** |

Direction stays Project → Module → Core: modules write entries, Core reads them; `layouts/admin.vue` imports nothing from a module and contains no path, capability or section id. Verified by reading and by the browser regression (`ar-ui.mjs`).

## Adding an admin section from a module

1. Register the capability on the backend (`defineCapabilities`) and guard the module's `/admin/<x>` routes with it.
2. Create `app/pages/admin/<x>/index.vue` with `definePageMeta({ layout: 'admin', middleware: 'admin' })`.
3. Add the i18n keys (`admin.<x>`, optionally `admin.subtitle_<x>`) in both locales.
4. Append to `adminSections`:
   ```ts
   { id: 'x', path: '/admin/x', labelKey: 'admin.x', subtitleKey: 'admin.subtitle_x', icon: 'box', capability: 'view:x', order: 45, group: 'main' }
   ```
5. Nothing else. The sidebar, active state, page title, landing page and route gating follow.

A section needing a counter badge sets `badgeStateKey` to a `useState<number>` key its own composable keeps up to date (the notifications inbox uses `admin-notif-unread`, written by `useAdminNotifications`).

## Permissions

- **Visibility** is decided on the client from `capability` against `/profile.permissions` (`usePermissions.can`). A staff member sees only the sections whose capability they hold; a section whose capability nobody registers is invisible to everyone (there is no wildcard).
- **Authorization** is the backend's: `PermissionsGuard` + `RequirePermissions` on the routes. The registry never widens access — the worst a wrong entry can do is show a link to a page whose API answers 403.
- `middleware/admin.ts` bounces a direct navigation to a section the user cannot see to `firstAllowedPath()` — the first visible section by `order` (owner → `/admin`, stock manager → `/admin/products`, accountant → `/admin`, unchanged from before). A path no section claims (e.g. a future `/admin/tools`) is open to any staff member, as before.
- `isStaff` = the owner role or at least one resolved capability. The shop's role names (`accountant`, `stock_manager`) no longer appear in Core; a registered preset with zero capabilities would count as non-staff, which is also what the backend's landing would show them: nothing.

## i18n

Entries carry keys, never text. Labels reuse the existing `admin.<id>` keys (EL/EN untouched); subtitles moved from English literals in the layout into `admin.subtitle_<id>` keys in both locales; the group heading is `admin.group_workspace`; the fallback page title is `admin.title`. A missing subtitle key renders an empty subtitle (`te()` check) rather than the key.

## Failure behaviour

`validAdminSections()` drops entries missing `id`/`path`/`labelKey`/`icon`/`capability`, paths outside `/admin`, duplicate ids and `enabled: false`, and reports each once (console warning in dev). An empty registry renders an empty sidebar and the fallback title; an unknown icon renders a plain square; an unknown group falls back to the first group. Covered by [`tests/admin-registry.test.mjs`](../tests/admin-registry.test.mjs) (`pnpm test`).

## Deferred

- Dashboard tiles / widget registry (blueprint §7.2) — the dashboard page stays a shop page.
- Nested sections and breadcrumbs — no admin page has a sub-route today.
- Mobile admin navigation — the admin layout has no mobile mode today; when one is added it renders the same `groups`.
- Moving the shop entries into the e-commerce layer's `app.config.ts` — with the layer split.
- The topbar bell is a Core feature (notifications) wired to Core's own route; it is not registry-driven and does not need to be.
