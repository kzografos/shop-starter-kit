# API access standard — `useApi`

Phase 2 milestone "useApi Migration". Every HTTP request the Nuxt app makes to the backend goes through [`app/composables/useApi.ts`](../app/composables/useApi.ts). One exception remains and is justified in place.

## The standard

`useApi()` returns a typed call function: `api<T>(path, opts?)`. It owns the base URL (`runtimeConfig.public.apiBase`), the cookie policy (`credentials: 'include'`), and the session recovery (401 → `POST /auth/refresh` → one retry). Callers pass a **relative** path (`/admin/staff`) and any ofetch option (`method`, `body`, `query`, `headers`).

Use it for: every authenticated call (admin pages, customer account, checkout and orders, notifications, profile, uploads), and for public catalogue reads too — the same client, typed, with the base URL in one place, and no behavioural cost (public reads never see a 401).

Do not use it for:
- **Server-side profile bootstrap** — [`app/plugins/auth.server.ts`](../app/plugins/auth.server.ts): the render forwards the browser's `cookie` header explicitly; `credentials: 'include'` means nothing on the server, and a refresh from the render would rotate the visitor's token without the browser ever receiving it. Marked `// raw-fetch:`.
- **Browser navigations** that are not HTTP calls: `window.location.href = `${apiBase}/auth/google`` (login page, guest CTA) — a redirect to the OAuth entry, not a fetch.
- Third-party endpoints (none today) and browser APIs.

Any new raw `$fetch`/`useFetch` to the backend carries a `// raw-fetch: <reason>` comment (AGENTS.md → Frontend rules) or it is a review finding.

## `useApi` behaviour (audited, unchanged except one fix)

| Aspect | Behaviour |
|---|---|
| Base URL, cookies | `baseURL: apiBase`, `credentials: 'include'` added to every call; caller options spread after, so they win |
| SSR | Works in setup on both sides: on the server it is a plain outbound fetch without cookies (as the raw calls were); public reads render server-side, session-gated pages already defer to the client |
| 401 handling | Not for `/auth/*` urls (login/register/reset errors propagate as-is). Otherwise: `POST /auth/refresh`; on success the original request is sent **once** more with identical options; a 401 from the retry propagates. On failure the hook `api:unauthenticated` fires (the auth store clears the session — [`plugins/auth-hooks.ts`](../app/plugins/auth-hooks.ts)) and the **original** error is rethrown. No loop is possible: the retry is not wrapped |
| Single-flight refresh | **Changed in this milestone.** The in-flight refresh promise was per `useApi()` instance; every page has its own instance and the admin layout polls the unread count, so two 401s from two instances started two refreshes — refresh tokens rotate (single use), so the second one failed and logged the user out. The promise is now shared per browser tab (module scope, client only); the server keeps a per-instance promise so SSR requests stay isolated. Verified in the browser: notifications page + unread poll both 401 → exactly one `/auth/refresh`, both retried |
| Errors | ofetch `FetchError` rethrown untouched: `err.data` is the backend body (`message`, `statusCode`), `err.response.status` / `err.statusCode` the status. Nothing normalised, nothing swallowed — callers keep their own toasts/branches (400 validation text, 403, 404 not-found states, 409 idempotency conflict) |
| Bodies | JSON objects are serialised by ofetch; `FormData` is passed through untouched (uploads keep their multipart boundary); `query` builds the querystring |
| Headers | Passed through (checkout's `Idempotency-Key` verified on the wire) |
| Typing | `api<T>(…): Promise<T>`; options typed as ofetch's; no `any` |
| Not supported | Timeouts/cancellation (ofetch `signal` can be passed per call; nothing uses it), request ids, response interceptors — deliberately out of scope |

## Migration inventory

44 raw references before (43 `$fetch` + 1 `useFetch`), 43 migrated, 1 retained.

| File | Calls | Auth | Side | Migrated to |
|---|---|---|---|---|
| `components/admin/ProductDrawer.vue` | `GET /categories`, `GET /admin/products/:id`, `POST /admin/products/:id/images` (FormData), `POST /uploads/image` (FormData), `PATCH …/images/order`, `DELETE …/images/:ref`, `PATCH /admin/products/:id`, `POST /admin/products` | staff | client | `api` (8) |
| `pages/admin/staff/index.vue` | `GET /admin/staff`, `PATCH :id/role`, `PATCH :id/password`, `POST`, `DELETE :id` | staff | client | `api` (5) |
| `pages/admin/categories/index.vue` | `GET`, `PATCH :id`, `POST`, `DELETE :id` | staff | client | `api` (4) |
| `pages/admin/notifications/index.vue` | `GET /admin/notifications`, `PATCH :id/read`, `PATCH read-all` | staff | client | `api` (3) |
| `pages/admin/orders/index.vue` | `GET /admin/orders`, `PATCH :id/status` | staff | client | `api` (2) |
| `pages/admin/products/index.vue` | `GET /admin/products`, `PATCH :id/deactivate` | staff | client | `api` (2) |
| `pages/admin/settings/index.vue` | `GET`, `PATCH /admin/settings` | staff | client | `api` (2) |
| `pages/admin/{analytics,customers,newsletter,index}.vue` | `GET /admin/analytics`, `/admin/customers`, `/admin/newsletter`, `/admin/stats` | staff | client | `api` (4) |
| `composables/useAdminNotifications.ts` | `GET /admin/notifications/unread-count` (60 s poll) | staff | client | `api` (1) |
| `pages/checkout/index.vue` | `useFetch /settings` → `useAsyncData(() => api('/settings'))`; `POST /orders` (Idempotency-Key); `POST /payments/create-checkout` | public / customer-or-guest | SSR + client | `api` (3) |
| `pages/checkout/cancel.vue` | `POST /payments/create-checkout` | customer-or-guest | client | `api` (1) |
| `components/layout/AppFooter.vue` | `POST /newsletter/subscribe` | public | client | `api` (1) |
| `components/filters/ProductFilters.vue` | `GET /products/brands`, `GET /categories` | public | SSR | `api` (2) |
| `composables/useProducts.ts` | `GET /products?…` | public | SSR | `api` (1) |
| `pages/index.vue` | `GET /products?onSale=true`, `GET /categories` | public | SSR | `api` (2) |
| `pages/products/index.vue`, `[slug].vue`, `brands.vue` | `GET /categories`, `GET /products/:slug`, `GET /products/:slug/related`, `GET /products/brands` | public | SSR | `api` (4) |
| `plugins/auth.server.ts` | `GET /profile` with forwarded cookie header | session | server | **retained** (`// raw-fetch:`) |

Previously migrated and unchanged: `stores/auth.ts`, `stores/favourites.ts`, `useCustomerNotifications.ts`, `pages/account/**`, `pages/login.vue`, `forgot/reset-password.vue`, `unsubscribe.vue`, `checkout/success.vue`, `GuestAccountCTA.vue`.

Endpoint paths, methods, payloads, query parameters, response shapes, loading states and error handling are unchanged at every site — the edit was `$fetch<T>(`${apiBase}/x`, { credentials: 'include', …rest })` → `api<T>('/x', { …rest })` plus `const api = useApi()` in setup (and the removal of the now-unused `apiBase` destructure).

## Conventions for new code

```ts
const api = useApi()                                   // in setup, once per component/composable
const { data, pending, error } = useAsyncData('key', () => api<Order[]>('/orders'))   // reads (SSR-safe)
await api('/orders/' + id + '/cancel', { method: 'POST' })                               // mutations
await api<ImagesPayload>(`/admin/products/${id}/images`, { method: 'POST', body: formData })  // uploads
try { … } catch (e) { const msg = (e as { data?: { message?: string | string[] } }).data?.message; toast(...) }  // errors
```

- Never `useApi()` inside a callback that may run outside a Nuxt context; call it in setup and close over `api`.
- Never catch and hide a 401/403/404/409 inside a composable unless the UI has a designed state for it (the admin unread poll swallows errors on purpose: a missing badge must not break the shell).
- The backend's refresh endpoint is throttled (3/min per IP); `useApi` treats a throttled refresh as a failed one. Real sessions refresh once per 15 minutes, so this only shows up in tests that expire tokens repeatedly.

## Tests

- [`tests/use-api.test.mjs`](../tests/use-api.test.mjs) (`pnpm test`, 13 cases): success with options/generic preserved; 401 → one refresh → one retry with identical options; refresh failure → hook once + original error, no retry; retry 401 propagates (no loop); `/auth/` never refreshes; 400/403/404/409/500 propagate untouched with the backend payload; concurrent 401s on one instance → one refresh; FormData + headers pass through; network error → no refresh.
- Browser (session harness `ua-ui.mjs`, 27 checks): every admin page fetches exactly once through `useApi` and renders; access token deleted → `401 → refresh 200 → retry 200` on a client-side navigation, data shown, cookie reissued; page + layout poll 401 together → **one** refresh; `PATCH /admin/settings` retried once, saved once, success toast; backend 400 message still reaches the toast; both cookies gone → `401 → refresh 401 → stop`, session cleared, hard navigation → login; checkout `POST /orders` carries `Idempotency-Key` → 201; anonymous catalogue/brands render; SSR HTML of a product page contains the product.
- Regressions: drawer image harness (upload/reorder/remove through `useApi` + FormData) 24/24; notifications bell 34/34, history 29/29, customer cancel 9/9, settings form 16/16, hardening UI 16/16, admin registry 27/27.

## Remaining raw calls

| Where | Why it stays |
|---|---|
| `app/plugins/auth.server.ts` | SSR cookie-header forwarding; no refresh must run during a render |
| `app/composables/useApi.ts` (2 internal `$fetch`) | the client itself |
| `window.location.href = …/auth/google` (login page, guest CTA) | a redirect, not a request |
