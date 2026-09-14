# Architecture Compliance Checklist

Run through this list for **every** implementation task — feature, fix, refactor, or migration step — before marking it done. Copy it into the pull request description and tick what applies. An unticked item needs a one-line reason.

Rules referenced are in [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md); the layer model is in [ARCHITECTURE-BLUEPRINT.md](ARCHITECTURE-BLUEPRINT.md) §2.

## Layer and ownership

```text
[ ] Correct layer identified (Core / Module / Infrastructure / Project) and stated in the PR.
[ ] The change lives in files owned by that layer (or the current path that maps to it).
[ ] No forbidden imports (CORE → MODULE, CORE → PROJECT, INFRASTRUCTURE → above, MODULE → PROJECT).
[ ] No cross-module internal imports — only another module's index.ts / exported services / events / contracts.
[ ] No Core references to optional modules: no module capability strings, setting keys, i18n keys, routes, components, stores, state keys or Prisma models inside Core files.
```

## Data

```text
[ ] Domain data owned by the correct module (its schema file, its service).
[ ] No domain-specific scalar field added to a Core model (User, Setting, NewsletterSubscriber, Notification).
[ ] No direct writes to another module's rows; reads go through the owner's exported service.
[ ] Schema change ships with its migration in the same commit; migration history stays linear.
[ ] Cache keys are namespaced (<module>:<entity>:<key>:<field>); no delPattern on a foreign namespace.
```

## Contributions and configuration

```text
[ ] Settings / capabilities / role presets / admin sections / navigation items / events are contributed by the module (registry entry or app.config), not hardcoded in Core.
[ ] Optional environment variables are conditional: declared in the module's Joi fragment, not required for Core-only boot; read via ConfigService, not process.env at import time.
[ ] No hardcoded brand, currency, locale list, address, phone or schema.org type — values come from project configuration.
[ ] Secrets are in environment variables only; nothing secret in project config or source.
```

## Frontend

```text
[ ] API calls use useApi(); no raw $fetch / useFetch with apiBase (or an explicit // raw-fetch: justification).
[ ] useApi() does not import or mutate a Pinia store.
[ ] No global layout / shell component (default layout, admin layout, AppHeader, AppFooter, AccountSidebar, account/index) coupled to an optional module.
[ ] Shared state keys are namespaced and wrapped in a composable.
[ ] Module components use the layer prefix (once layers exist); no duplicate component names across layers.
[ ] Pages declare guards via definePageMeta; no module-added global middleware.
[ ] i18n keys added only to namespaces owned by this layer/module.
```

## Quality

```text
[ ] Typecheck considered (nuxi typecheck / tsc --noEmit) — run if available, otherwise stated as not run.
[ ] Lint considered (eslint) — run if available.
[ ] Tests considered: critical Core behaviour touched (auth, permissions, settings, events, useApi) has a unit test or a stated reason it does not.
[ ] Boundary check considered (dependency-cruiser / boundaries lint) — run once it exists.
[ ] Behaviour preserved: route paths, response shapes and existing flows unchanged unless the task requires otherwise (and says so).
```

## Documentation

```text
[ ] Documentation updated if the architecture changed: ARCHITECTURE-DECISIONS.md (superseding record), blueprint summary table, DEPENDENCY-RULES.md, MODULE-DEVELOPMENT-GUIDE.md as applicable.
[ ] "Current known violations" table in DEPENDENCY-RULES.md §11 updated if a violation was removed or (temporarily) introduced.
[ ] Downstream impact noted in PETSHOPCY-MANUAL.md if the change cannot propagate by cherry-pick or must not be cherry-picked.
```

## Sign-off

```text
Layer: ______   Module (if any): ______   Blueprint phase: ______   Seam(s) touched: ______
```
