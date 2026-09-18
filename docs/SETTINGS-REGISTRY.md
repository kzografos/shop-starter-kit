# Settings Registry

Phase 2, second registry. Every setting is described once, by the module that owns it, in a typed definition the backend registers at boot; Core stores the values, applies the defaults, validates writes, serves the public subset and hands the definitions to the admin form, which renders them without naming a single key.

## Why

Before this change the five pricing keys existed in four places: the orders module (`PRICING_SETTING_KEYS`), the seed (`seedSettings()` with its own copy of the default values), the admin form (`app/pages/admin/settings/index.vue` with hard-coded fields, labels, `min`/`step` attributes and a second copy of the defaults), and `SettingsService` (which knew only `key` + `type`). Adding one setting meant editing all four, and the admin page — a Core page — knew the shop's vocabulary. The public read (`GET /settings`) was a shop controller returning a hand-picked list rather than a rule.

## Audit of existing settings

| Key | Owner | Kind | Type | Default | Public | Editable | Constraints |
|---|---|---|---|---|---|---|---|
| `shipping_cost` | orders (shop) | pricing | number | `5.00` | yes | yes | min 0, step 0.01, unit € |
| `free_shipping_threshold` | orders (shop) | pricing | number | `50.00` | yes | yes | min 0, step 0.01, unit € |
| `loyalty_earn_rate` | orders (shop) | pricing | number | `100` | yes | yes | min 0, step 1 |
| `loyalty_redeem_rate` | orders (shop) | pricing | number | `100` | yes | yes | **min 1** (it divides the discount), step 1 |
| `loyalty_min_redeem` | orders (shop) | pricing | number | `500` | yes | yes | min 0, step 1 |

There are no Core settings, operational settings, feature flags or deprecated keys in the table today. Everything a provider needs (Stripe, MinIO, mail, Google, brand values for emails) is environment configuration and stays out of the settings table by rule (`AGENTS.md` → Configuration rules). All five pricing values are shown to customers (shipping banner, loyalty card, checkout total), so all five are public; nothing private exists yet — the private path is nonetheless implemented and tested so the first private setting is safe by default.

## Contract

[`backend/src/settings/setting-definition.ts`](../backend/src/settings/setting-definition.ts) (the authority) — mirrored on the wire in [`types/index.ts`](../types/index.ts) as `SettingDefinition` / `SettingGroup` / `AdminSettingsPayload` (snake_case):

```ts
interface SettingDefinition {
  key: string                    // row key, globally unique
  type: 'number' | 'string'      // validation on write, parsing on public read
  default: string                // stored form; THE default
  group: string                  // SettingGroupDefinition id → one admin card per group
  labelKey: string               // i18n
  descriptionKey?: string        // i18n hint under the field
  order?: number                 // inside the group
  public?: boolean               // served by GET /settings (default false)
  editable?: boolean             // writable via PATCH /admin/settings (default true)
  min?: number; max?: number; step?: number   // number constraints; also the form's input attributes
  unit?: string                  // shown next to the label
}
interface SettingGroupDefinition { id: string; labelKey: string; descriptionKey?: string; icon?: string; order: number }
```

Kept out on purpose: booleans/enums/select options (no consumer), per-setting capabilities (one `manage:settings` capability gates the whole form; a per-key capability can be added to the definition when a module needs it), custom validators, a form-builder.

## Ownership

| Piece | Owner | Role |
|---|---|---|
| `settings/setting-definition.ts` | Core | contract |
| `settings/settings.service.ts` | Core | registry (`define`, `defineGroups`, boot validation), `getAll()` with defaults, `getPublic()`, admin read/write with validation |
| `settings/settings.controller.ts` — `GET /settings` | Core | public subset (`public: true` only) |
| `settings/settings-admin.controller.ts` — `GET`/`PATCH /admin/settings` (`manage:settings`) | Core | `{ groups, definitions, values }` / validated writes |
| `orders/pricing-settings.ts` + `pricing-settings.service.ts` | orders (shop) | definitions, groups, defaults, constraints; `loadPricing()` typed view for the checkout |
| `app/utils/settings-form.ts`, `app/pages/admin/settings/index.vue` | Core | render whatever the API describes |
| i18n keys named by definitions | the contributing module (today in the shared `admin.*` namespace, until the per-layer split) | labels, hints, group titles |

Direction: orders → Core (registration through the exported `SettingsService`); Core imports nothing from orders. `verify-boundaries` stays at 0. The public controller moved from `orders/pricing-settings.controller.ts` to Core: same path, same response shape, now a registry rule instead of a list.

## Registering a setting from a module

1. Describe it next to the module's other definitions (defaults, constraints, i18n keys, `public` if the storefront needs it):
   ```ts
   export const MY_SETTINGS: readonly SettingDefinition[] = [
     { key: 'pickup_lead_hours', type: 'number', default: '2', group: 'fulfilment', labelKey: 'admin.pickup_lead_hours', order: 10, min: 0, step: 1, public: true },
   ]
   export const MY_GROUPS: readonly SettingGroupDefinition[] = [{ id: 'fulfilment', labelKey: 'admin.fulfilment_settings', icon: 'box', order: 30 }]
   ```
2. Register at boot from a provider's `onModuleInit`: `this.settings.defineGroups(MY_GROUPS); this.settings.define(MY_SETTINGS)`. An incomplete definition, a default outside its own constraints, or a duplicate key/group id fails boot with the reason.
3. Add the i18n keys in both locales.
4. Read the value through `SettingsService.getAll()` (or your own typed view like `loadPricing()`); it is present even before anyone saves the form.

Nothing else: the admin form renders the new card/field, the write path validates it, the public read serves it if `public`.

## Public vs private

- `GET /settings` (no guard, throttle-exempt) returns **only** definitions marked `public: true`, parsed to their type. The filter is the registry; a stored row for a private or unregistered key is never serialised there, whatever the caller does. A corrupt numeric row (hand-edited) is served as the default rather than `null`.
- `GET`/`PATCH /admin/settings` require `manage:settings` (backend guard; the admin shell hides the section for anyone else). The admin payload includes private definitions; `editable: false` definitions are shown but a write to them is refused (400).
- Secrets never go in the settings table (env only).

## Defaults and seed

- The definition's `default` is the one authoritative default. `SettingsService.getAll()` merges `{ ...defaults, ...storedRows }`, so a fresh installation prices, displays and edits with the defaults before a single row exists; a row is created only when the owner saves the form.
- `prisma/seed.ts` no longer writes settings rows. It never overwrote existing rows before either (`update: {}`), and now it does not touch the table at all — customised production values (e.g. the live `7.5` / `200`) survive every seed and every deploy.
- Rows whose key is not registered (a module temporarily disabled) are kept in `getAll()` and ignored by the form and the public read; they come back when the module registers again.
- No migration was needed: the `settings` table is unchanged.

## Validation

Owned by the backend, from the definition: type (`number` must be finite; `string` must be a string), `min`, `max`, `editable`. The form mirrors `min`/`max`/`step` as input attributes for a better UX but does not duplicate the rule; a backend 400 is shown as-is in the toast (`loyalty_redeem_rate must be at least 1`). Module-level meaning (a NaN stored value must not price an order) stays with the module: `loadPricing()` still fails loudly on a non-numeric row.

## API changes

- `GET /admin/settings` now returns `{ groups, definitions, values }` instead of a bare `{ key: value }` map. Only the admin form consumed it.
- `PATCH /admin/settings` unchanged on input; returns the new payload; now also enforces `min`/`max`/`editable` (previously only "non-negative number").
- `GET /settings` unchanged in path and shape; served by Core, filtered by `public`.

## Tests

- Backend harness (46 checks): definition validation (12 cases), duplicate key/group, boot registration order, defaults with no rows / partial rows / stored rows, `loadPricing()` on defaults and on a corrupt row, admin payload shape, permissions (401/403/200), write validation (min, non-numeric, empty, Infinity, numeric string, empty body, unknown key ignored), cache invalidation, private key never public, non-editable refused, unregistered row handling, order pricing from stored value, seed contains no settings, customised rows preserved.
- `pnpm test` → [`tests/settings-form.test.mjs`](../tests/settings-form.test.mjs) (5 tests): renderable filtering, cards/order/unknown group, initial values, PATCH body.
- Browser: registry-driven cards/fields/labels/hints/units/min/step, load, save round-trip, backend validation toast, Greek, stock-manager bounce + 403.

## Deferred

- Boolean/select setting types and per-setting capabilities — add to the contract when a consumer exists.
- Moving the pricing i18n keys out of the shared `admin.*` namespace — with the per-layer i18n split.
- Migrating the settings page from raw `$fetch` to `useApi()` — the project-wide `useApi` migration milestone.
- A Core-owned public settings composable on the frontend — today the checkout reads `GET /settings` directly, as before.
