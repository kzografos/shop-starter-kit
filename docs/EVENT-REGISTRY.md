# Event Registry and Event Boundary Review

Inventory of every event-like mechanism in the application as it exists at `dd8d2aa`: who produces it, who consumes it, how it fails, and whether it can move with its layer. Documentation only — nothing was changed. Read with [MODULE-REGISTRY.md](MODULE-REGISTRY.md) (module ownership) and [DEPENDENCY-RULES.md](DEPENDENCY-RULES.md) (direction rules).

Sources: `backend/src/core/events/*`, every `events.emit`/`events.on`, `OnModuleInit` registration, `ProcessedEvent` use, fire-and-forget (`.catch(() => null)`) site, `MailService` send, cache `invalidate()` call and notification producer in `backend/src`; `nuxtApp.hook`/`callHook`, `watch`, `useState` and `refreshNuxtData` on the frontend; the unit tests under `tests/`; the session harnesses from the notification, order-lifecycle, payments and hardening milestones (results recorded in their docs, harnesses themselves not in the repo).

## 0. What counts as an event here

The codebase has exactly **one** event bus (`CoreEventBus`) carrying **one** event. Everything else that "reacts to something" is one of: a direct service call made by the module that owns the decision (stock alerts, order-status notifications, cache invalidation, transactional mail), an inbound webhook parsed into a neutral shape, a boot-time registry contribution, or a frontend hook/watcher. The inventory lists all of them so nothing is mistaken for a domain event later, and classifies each by what it actually does.

---

## 1. Event inventory

### 1.1 Domain event on the Core bus

| | `user.authenticated` |
|---|---|
| Category | Authentication/session event (Core domain event) |
| Contract | `core/events/core-event.types.ts` → `CoreEventMap['user.authenticated']: { userId, email, isNewUser }` |
| Publisher | `auth/auth.service.ts` `announceAuthenticated()` — called from `register` (isNewUser true), `login` (false), `googleLogin` (true when the account was created) |
| Trigger | A credential/OAuth check succeeded and the `User` row exists (created or found); emitted **before** tokens are issued, **after** the user row's own write has committed (there is no surrounding transaction) |
| Consumers | `orders/guest-order-linker.service.ts` (`GuestOrderLinkerService.onUserAuthenticated`), registered in `onModuleInit` via `events.on('user.authenticated', …)` |
| Side effects | Guest orders with `guestEmail = email` and `userId = null` are attached to the user; loyalty points are earned for the ones already PAID (`LoyaltyService.earn` inside the same transaction) |
| Sync/async | **Synchronous and awaited**: `CoreEventBus.emit` runs subscribers sequentially and `AuthService` awaits it so the linked orders/points are visible in the login response |
| Idempotent | **Yes** — each order is claimed with a conditional update inside the transaction and awarded only by the claimer (R3, fixed) |
| Failure | Subscriber errors are **logged and swallowed** by the bus (failure policy E14): login succeeds; a failed link is retried naturally on the next authentication. No retry queue |
| Tests | Not in the repo. Covered by the seam-1/seam-2 session harnesses at the time (link + award, idempotent re-login); `tests/` has no bus test |

### 1.2 Inbound webhook events (Infrastructure boundary → Shop)

| | `checkout.session.completed` | `checkout.session.expired` |
|---|---|---|
| Category | Webhook event → integration event | Webhook event → integration event |
| Contract | `payments-provider/payment-provider.ts` `WebhookEvent` (`{ id, type, checkoutCompleted: { orderId, userId, amountTotalMinor, paymentIntentId } }`) | same union, `checkoutExpired: { orderId }` |
| Publisher (external) | Stripe → `POST /payments/webhook` (raw body + signature) | same |
| Parser | `StripePaymentProvider.parseWebhook` — verifies the signature, maps to the neutral shape; any other Stripe type becomes `{ checkoutCompleted: null, checkoutExpired: null }` (ignored) | same |
| Consumer | `payments/payments.service.ts` `handleWebhook` | `handleCheckoutExpired` |
| Side effects | `ProcessedEvent` row + order → CONFIRMED/PAID + Stripe intent id + loyalty EARN (one batch transaction), then the CONFIRMED customer notification (same transaction), then order-confirmation mail (fire-and-forget) | `OrdersService.cancel()` (restock, loyalty reversal, CANCELLED notification, in one transaction) then `ProcessedEvent` row |
| Sync/async | Synchronous within the HTTP request; the provider retries on non-2xx | same |
| Idempotent | **Yes** — `ProcessedEvent.eventId` primary key leads the transaction; a redelivery rolls the batch back (`P2002` → "already processed", 200) | **Yes** — ledger check first, status-conditional cancel (409/400 on a race → 200 "ignored"), ledger insert after with `P2002` swallowed |
| Failure | Signature failure 400; provider unconfigured 503; amount mismatch / already paid / already cancelled → logged, 200 (not retried on purpose); unexpected DB error → propagated → provider retries | unexpected error propagated → provider retries; the order is released at most once |
| Tests | Session harnesses `seam6-payments`, `ol3-expired`, `nt2` (concurrent deliveries, redelivery, staff-preconfirmed order) — recorded green in the corresponding docs; nothing in `tests/` |

### 1.3 Notification producers (direct calls, not bus events)

| | Order status → customer notification | Stock alert → staff notification |
|---|---|---|
| Category | Notification event (domain-owned rule, Core persistence) | Notification event |
| Producer | `orders/order-notifications.service.ts` `statusWrite(client, order, status)` — every arrival at CONFIRMED / PROCESSING / READY / COMPLETED / CANCELLED, guest orders skipped | `products/stock-alerts.service.ts` `checkStock(product)` — open/refresh/escalate/resolve per product + type |
| Triggers | `OrdersService.create` (non-Stripe settle), `updateStatus`, `cancel`; `PaymentsService.handleWebhook` (CONFIRMED) | `ProductsService` admin update/deactivate (awaited); `OrdersService.create` and `cancel` (fire-and-forget after commit) |
| Contract | Core `NotificationsService.createWrite` / `create` with `{ type, userId?, key?, meta }`; key `order:<id>:status:<status>` | `{ type, productId, stock, meta }` on the staff inbox (`userId null`) |
| Consumers | Customer feed (`/notifications*`), bell, history page | Staff inbox (`/admin/notifications*`), admin badge |
| Sync/async | **Inside the status transaction** (`createWrite` = `ON CONFLICT DO NOTHING`); unread-cache invalidation after commit | Awaited on catalogue writes; detached after order commit via `afterCommit()` (`common/utils/after-commit.ts`) |
| Idempotent | **Yes** — unique `key` per order + status; duplicate/concurrent transitions leave one row | Yes — de-duplicated per product + type via `findOpen` |
| Failure | A write failure rolls the whole status transaction back (no half state); FK errors propagate | Catalogue path: propagates; order path: logged as `Order <id> stock alert for product <id> failed after commit` by `OrdersService`, request unaffected (R7) |
| Tests | `nt2` (33 checks), `nt1` (32) session harnesses; browser `nt3`/`nt5` | `nt1`/`nt2` (stock alert stays in staff inbox) |

### 1.4 Transactional mail (side effects, not events)

| Trigger | Sender | Policy |
|---|---|---|
| Password reset requested | `auth.service.forgotPassword` → `mail.sendPasswordReset` | awaited, send failure logged inside `MailService` (never throws) |
| First newsletter subscription | `newsletter.service.subscribe` → `mail.sendWelcomeEmail(email, unsubscribeUrl)` | fire-and-forget (`MailService` logs the send failure itself) |
| Non-Stripe order placed | `orders.service.create` → `sendMail(orderConfirmationMail…)` | detached after commit via `afterCommit()` |
| Online payment settled | `payments.service.handleWebhook` → same template | detached after commit via `afterCommit()` |

Category: infrastructure side effect. `MailService` is disabled-safe (503-style warning, no throw); no queue, no retry, no delivery record.

### 1.5 Cache invalidation calls (owner-to-owner, not events)

| Producer | Calls | Reason |
|---|---|---|
| `OrdersService.create` | `analytics.invalidate()` (detached via `afterCommit()`) | a new order changes reports |
| `OrdersService.cancel` | `products.invalidate()` (awaited), `analytics.invalidate()` (detached via `afterCommit()`) | restock changes catalogue and reports |
| `CategoriesService` writes | `products.invalidate()` + own `categories:tree` | category tree is embedded in product reads |
| `ProductsService` writes | own `products:*` | — |
| `SettingsService.updateAdminSettings` | own `settings:all` | pricing must apply immediately |
| `NotificationsService`, `OrderNotificationsService` | `notifications:unread:*` per user / staff | after commit |
| `PaymentsService.handleWebhook` | `analytics.invalidate()` (detached via `afterCommit()`, after the settlement transaction commits) | the order became `PAID`, which is what every report counts (R5, fixed) |

Category: infrastructure event (Redis key deletion). Synchronous, idempotent, failure swallowed by `RedisService` (WARN).

**Detached post-commit policy (R7).** Every side effect that runs after a committed order/payment transaction and is not awaited goes through `afterCommit(logger, label, work)` in `backend/src/common/utils/after-commit.ts`: `work` starts synchronously, the promise is never awaited, and any rejection or synchronous throw is logged by the *calling* service's logger at `error` level as `<label> failed after commit: <message>` with the stack. Labels carry the order id (and product id for stock alerts). The committed transaction is never affected and the request never fails because of the side effect. No retry — see R7 for the per-effect reasoning. Sites today: `OrdersService.create` (confirmation mail, analytics, one stock alert per line), `OrdersService.cancel` (analytics; the re-read of restocked rows *and* each stock alert, so a database error after the commit can no longer fail an already-cancelled order), `PaymentsService.handleWebhook` (analytics, confirmation mail). Unit-tested in `backend/test/after-commit.test.mjs` (`npm test`, part of `npm run verify`).

### 1.6 Boot-time registry contributions (not runtime events)

`OnModuleInit` hooks that *register* rather than react: `CatalogPermissions`, `OrdersPermissions`, `AnalyticsPermissions` (capabilities/presets), `PricingSettingsService` (settings + groups), `LoyaltyUserExtension`, `OrdersUserExtension` (profile fields), `GuestOrderLinkerService` (the one bus subscription), `PrismaService` (`$connect`), `MinioStorageAdapter` (client). Ordering: Nest initialises modules in import order; duplicate registrations fail boot. Not events; listed so they are not mistaken for ones.

### 1.7 Frontend event-like mechanisms

| Mechanism | Category | Publisher → consumer | Notes |
|---|---|---|---|
| Nuxt hook `api:unauthenticated` | session event | `composables/useApi.ts` (refresh failed) → `plugins/auth-hooks.ts` → `useAuthStore().clearSession()` | typed in `useApi.ts` (`RuntimeNuxtHooks`); one-directional so `useApi` never imports a store; universal (server + client) |
| `watch(isLoggedIn)` | session reaction | `NotificationBell.global.vue`: sign-in → `refreshCount()`, sign-out → `reset()` (bumps the feed `epoch` so a late response is discarded) | reacts to store state, not a bus |
| `useState` keys | shared state, not events | `admin-notif-unread` (written by `useAdminNotifications`, read by the admin shell through a registry `badgeStateKey`), `customer-notif-*`, `cart-open` | all wrapped in composables |
| `refreshNuxtData('orders')` | data refetch signal | `pages/account/orders/[id].vue` after a self-cancel → order list refetch | Nuxt data layer, not domain |
| Route middleware `auth`/`admin`/`guest` | navigation guards | — | not events |

No frontend code subscribes to backend events (no SSE/WebSocket); the unread badge polls every 60 s.

---

## 2. Event ownership

| Event / mechanism | Contract owner | Decision owner (when it fires) | Allowed consumers |
|---|---|---|---|
| `user.authenticated` | Core (`core/events/core-event.types.ts`) | Core `auth` | Any module (Shop today: `orders`). Core subscribes to nothing from modules |
| `WebhookEvent` (`checkout.session.completed` / `expired`) | Infrastructure (`payments-provider`) — provider-neutral shape | External provider decides the fact; Shop `payments` decides what it means for the order | Shop `payments` only; nothing else reads webhooks |
| Order-status notification (`order:<id>:status:<s>`) | Core owns the row contract (`NotificationsService`); Shop `orders` owns the key format, statuses and `meta` | Shop `orders` (and `payments` through `OrderNotificationsService`) | Core feed/bell (renders by type); the *wording* lives in Core `useCustomerNotifications.describe()` — ownership is split, see B5 |
| Stock alert (`LOW_STOCK` / `OUT_OF_STOCK`) | Core row contract; Shop `products` owns the rule and `meta` | Shop `products` | Core staff inbox |
| Cache invalidation | Each cache owner (`invalidate()`) | The writer that changed the data | Only the owner deletes its namespace (seam 8) |
| Mail sends | Infrastructure `MailService` (transport + layout); templates owned by the sending module | Sending module | — |
| `api:unauthenticated` | Core frontend (`useApi`) | `useApi` | Session owner (`auth` store via plugin) |

**Unclear or split ownership**
- Order-status wording: produced by Shop, rendered by Core (B5 below).
- `ProcessedEvent`: Infrastructure table (`infrastructure.prisma`), but written only by Shop `payments`, and it carries `orderId` — a Shop column on an Infrastructure ledger (blueprint §9 already plans `subjectId`).
- Shop role presets (`accountant`, `stock_manager`) are registered from `orders/` — a registry contribution, not an event, but the same "no shop root yet" gap.

---

## 3. Event boundaries

### 3.1 Confirmed

| # | Check | Result |
|---|---|---|
| B1 | Core publishes Shop-specific events | **No.** The only Core event is identity-only (`userId`, `email`, `isNewUser`); no Shop data in Core payloads |
| B2 | Shop publishes Core-specific events | **No.** Shop publishes nothing on the bus; its reactions are direct calls into its own sub-domains or into Core services it is allowed to use (`NotificationsService`) |
| B3 | Infrastructure events leak business logic | **No.** `parseWebhook` only verifies and maps; amount checks, order state, loyalty and mail decisions are in Shop `payments`; `MailService` renders a layout and sends — templates are the modules' |
| B4 | Auth/session events consumed by unrelated modules | **No.** One consumer (`orders` guest linking) with a legitimate need; consumption is through the typed bus, not by importing `auth` |
| B5 | Notification events tightly coupled to implementations | **Partly.** Row contract, keys and `meta` are stable and module-owned; but the customer-facing text for `order_status` rows is hard-coded in Core `useCustomerNotifications.describe()` (documented deferral: a presenter registry once a second type exists). The staff inbox page likewise knows the two stock types (`out_of_stock`/`low_stock`) |
| B6 | Webhook processing separated from domain processing | **Yes.** Provider verification/mapping (Infrastructure) → `PaymentsService` orchestration (Shop) → `OrdersService.cancel()` / `OrderNotificationsService` (Shop domain) → `NotificationsService` (Core persistence). Webhooks never touch the `CoreEventBus` |
| B7 | Event contracts shared through appropriate abstractions | **Yes for the bus and the webhook** (`CoreEventMap`, `WebhookEvent`); **no contract at all** for the "events" that are really direct calls — they are ordinary service method signatures, which is acceptable at this size but is the thing an Event Registry would formalise |
| B8 | `ProcessedEvent` carries a Shop column (`orderId`) in an Infrastructure table | **Confirmed leak** (schema-level, documented in the blueprint as a future `subjectId` rename) |

No confirmed rule violation on the bus itself. B5 and B8 are boundary findings; the rest are clean.

### 3.2 Recommendations (not done)

- Give the two notification producers explicit contracts (`OrderStatusNotification`, `StockAlertNotification` types next to their producers) so the frontend presenters can import the `meta` shape instead of guessing it.
- Rename `ProcessedEvent.orderId` → `subjectId` with the next Infrastructure migration.
- When a second bus event exists, add an event name registry (typed map per module, merged in the composition root) rather than growing `CoreEventMap` with module events — see §6.

---

## 4. Reliability and consistency review

| # | Area | What exists | Finding |
|---|---|---|---|
| R1 | Webhook dedupe (`checkout.session.completed`) | `ProcessedEvent` insert is the **first** statement of the settlement batch; PK on `eventId`; concurrent deliveries of the same id → one wins, the other's batch rolls back; a second Stripe event id for an already-paid order is stopped by the `paymentStatus === 'PAID'` guard | **Sound.** Verified with concurrent and redelivered events |
| R2 | Webhook dedupe (`checkout.session.expired`) | Read ledger → status-conditional `cancel()` (409 on race) → write ledger (`P2002` swallowed). Crash between cancel and ledger write → the retry finds the order CANCELLED and answers 200 | **Sound**; ledger is a delivery record, the status transition is the real guard |
| R3 | `user.authenticated` → guest-order linking | ~~`findMany` of guest orders outside the transaction, then `updateMany` + award over the pre-read list~~ **Fixed:** candidates are read inside the transaction and each order is claimed with a conditional `updateMany({ id, userId: null })`; a concurrent claimer blocks on the row lock, re-evaluates the condition after commit, matches 0 rows and awards nothing; points are earned only for rows the transaction itself claimed | **Closed.** Verified with 5 concurrent `link()` calls and 4 parallel HTTP logins over paid guest orders: one EARN per order, balance = sum once (the pre-fix code produced 3–5 EARN rows per order in the same harness). No schema change: a unique `(orderId, type)` was not usable because cancellation legitimately writes a second, negative EARN row per order |
| R4 | Publication timing vs. commit | `user.authenticated` is emitted after the user row exists and before tokens are issued; no outbox. A crash between commit and emit loses nothing durable: the link runs again on the next login | **Acceptable** for this event; would not be for an event whose consumer cannot re-derive the fact |
| R5 | Cache invalidation after online payment | ~~`PaymentsService.handleWebhook` does not call `AnalyticsService.invalidate()`; analytics count `PAID` orders~~ **Fixed:** the webhook calls `analytics.invalidate()` (owner method, `.catch(() => null)`) once, right after the settlement batch commits — the same post-commit, fire-and-forget pattern `OrdersService.create`/`cancel` use. Only the PENDING→PAID/CONFIRMED path reaches it: no-op events, unknown/cancelled orders, already-paid orders, amount mismatches, ledger duplicates (P2002) and failed transactions all return or throw before it | **Closed.** Verified on a scratch DB: settlement invalidates exactly once with the order already `PAID` at call time; redelivery, a new event id for a paid order, three concurrent deliveries (one `ProcessedEvent`), mismatches and a forced transaction failure invalidate zero times; a rejecting `invalidate()` leaves the webhook 200 and the order `PAID` (Redis is fail-soft, same policy as the other owners; failure is not logged — R7) |
| R6 | Transaction boundaries | Order create/cancel/status, webhook settlement, guest linking, notification writes: each a single transaction; side effects (mail, analytics invalidation, stock alerts, unread-cache) after commit | **Sound**; documented in [MODULE-DEVELOPMENT-GUIDE §3.10](MODULE-DEVELOPMENT-GUIDE.md) and HARDENING-IMPLEMENTATION |
| R7 | Fire-and-forget after commit | ~~Mail (4 sites), `analytics.invalidate()` (2), `stockAlerts.checkStock` in `orders` (2): `.catch(() => null)`~~ **Fixed:** the seven detached sites in `orders`/`payments` go through `afterCommit()` (§1.5), which logs every failure with label, reason and stack through the calling service's logger; `cancel()`'s post-commit re-read of restocked rows is detached too (it was awaited and could fail a committed cancellation). Newsletter welcome mail keeps its bare `.catch` — `MailService` already logs, and it is not an order/payment side effect. **Retry analysis:** `analytics.invalidate()` — idempotent and safe to retry, but Redis is fail-soft and the cache self-heals within the 5-min TTL, so a retry buys nothing; `stockAlerts.checkStock()` — safe under *sequential* re-execution (`findOpen` → `update`, `resolveOpen` is an `updateMany`) and re-derived on the next stock change, but a retry would replay a stale stock figure over a newer alert and two *concurrent* runs for one product can still open two rows (no unique key on `(productId, type)` — pre-existing); confirmation mail — not idempotent, a retry means a duplicate email. Crash after the effect succeeded but before it was observed loses nothing durable (cache/alert re-derive). Therefore: log, no retry | **Closed** (logging). Retry/outbox remains a documented future improvement; a unique open-alert key would be its prerequisite for stock alerts |
| R8 | Ordering assumptions | Bus subscribers run in registration order (one today). Webhooks: Stripe may deliver `expired` after `completed` for the same session — handled (`completed` first: PAID guard; `expired` first: cancel then `completed` sees CANCELLED → refund manually, logged) | **Handled**, including the out-of-order case |
| R9 | Retry semantics | Webhooks: provider retries on non-2xx (unexpected errors propagate; business rejections answer 200). Bus: none. Mail: none | **By design**; no queue/outbox anywhere (blueprint §14.2 deferral) |
| R10 | Duplicate side effects | Notifications: key-unique. Loyalty on settlement: inside the ledger-guarded batch. Stock restock: status-conditional. Order creation: `Idempotency-Key`. Guest linking: conditional claim per order (R3) | **Sound** |
| R11 | `ProcessedEvent` growth | No purge; indexed on `processedAt` | Grows one row per webhook forever; harmless at this scale, needs the same retention job notifications will |

Confirmed findings: none open. **R3** (double loyalty award on concurrent authentication), **R5** (analytics cache not invalidated by the webhook) and **R7** (silent detached failures) are fixed. Everything else is sound as implemented.

---

## 5. Extraction readiness

| Component | Classification | Why |
|---|---|---|
| `core/events/` (`CoreEventBus`, `CoreEventModule`, `CoreEventMap`, `user.authenticated` type) | **Safe to move with Core** | No imports; global module; the contract is Core-only data |
| `auth.service` emit | Safe with Core | Publisher and contract are both Core |
| `payments-provider` (`WebhookEvent`, `StripePaymentProvider`) | **Safe to move with Infrastructure** | Neutral contract, one implementation, no Shop import (`core/config` import is the F1 item from the Module Registry) |
| `ProcessedEvent` model + migrations | **Requires contract extraction first** | Lives in `infrastructure.prisma` but is written by Shop with a Shop column; rename to `subjectId` (or move the model to the e-commerce schema file) before either layer is packaged |
| `payments/payments.service.ts` webhook handling | **Safe to move with Shop** | Depends on `PaymentProvider` (Infra contract), `OrdersService`, `LoyaltyService`, `MailService`, `OrderNotificationsService` — all reachable from the Shop layer |
| `orders/guest-order-linker.service.ts` | **Safe to move with Shop** | Subscribes through the exported bus; R3 fixed |
| `orders/order-notifications.service.ts`, `products/stock-alerts.service.ts` | **Safe to move with Shop** | Depend only on Core's exported `NotificationsService` |
| `notifications/` (rows, inboxes, `createWrite`) | **Safe to move with Core** | No producer knowledge |
| `useCustomerNotifications.describe()` order-status wording; admin inbox's stock-type branches | **Requires contract extraction first** | Core code rendering Shop `meta`; needs a presenter/type contribution (registry) or the wording moves to the Shop layer |
| `MailService` + transports | Safe with Infrastructure | Templates already live with their modules |
| Cache `invalidate()` owners | Safe with their owning module | Cross-owner calls go through exported services |
| Frontend `api:unauthenticated` hook, `auth-hooks` plugin, `useApi` | Safe with Core frontend | Contract declared in `useApi.ts` |
| Registry contributions (`OnModuleInit` registrars) | Safe with their module | Nest init order is the only coupling; unchanged by folder moves |
| `app.module.ts` module order (who registers before whom), Stripe `rawBody` in `main.ts` | **Must remain in the composition root** | Boot composition, not a module concern |
| Anything needing **redesign before extraction** | none | No component requires a redesign (R3 and R5 done) |

---

## 6. Recommended target boundaries (proposal, not implemented)

Supported by what exists today; nothing here requires a queue or an outbox.

1. **Keep one in-process bus, split the contract by owner.** `CoreEventBus` stays in Core (Infrastructure-like mechanism, Core-owned). The typed map becomes an `EventMap` merged from per-module declarations — Core declares `user.authenticated` (+ the blueprint's planned `user.registered`, `user.password_reset` when a consumer exists); Shop declares its own (`order.placed`, `order.status_changed`, `order.paid`, `product.stock_changed`) in `modules/ecommerce/events.ts`. The composition root merges the maps; Core still subscribes to nothing from modules.
2. **Promote the two notification producers to Shop domain events only when a second consumer appears.** Today `OrderNotificationsService` and `StockAlertsService` are the *only* consumers of their facts and they must run inside the producing transaction; a bus event (post-commit, log-and-continue) would weaken that. Keep them as direct calls; document them as the *sources* of the future `order.status_changed` / `product.stock_changed` events.
3. **Webhooks stay integration events, never bus events.** Provider → neutral `WebhookEvent` (Infrastructure) → `PaymentsService` (Shop) with the `ProcessedEvent` ledger. If other providers arrive, they implement `PaymentProvider.parseWebhook` and nothing else changes.
4. **Ledger becomes provider-neutral**: `ProcessedEvent { eventId, source, eventType, subjectId, processedAt }`, owned by Infrastructure, usable by any webhook/ingest consumer.
5. **Notification presenters as a frontend registry contribution** (like admin sections): each module contributes `{ type, describe(row) → { title, body, to } }`; Core's bell/feed/inbox render through it. Removes B5.
6. ~~**Fix R5 as an ordinary bug fix** before any event work~~ Done: `PaymentsService.handleWebhook` calls `analytics.invalidate()` after settlement (R3 is also fixed: per-order conditional claim inside the linking transaction). `PaymentsModule` now imports `AnalyticsModule` — a Shop→Shop dependency, no new layer seam.
7. **Explicit failure policy per mechanism** (document, then enforce): bus = log-and-continue + naturally re-derivable; transactional side effects = inside the transaction; post-commit side effects = detached but **logged** — done for orders/payments through `afterCommit()` (§1.5, R7). Still to enforce: a boundary check that flags a bare `.catch(() => null)` on a post-commit call; a retry/outbox only once each effect is provably idempotent (stock alerts need a unique open-alert key first).

---

## 7. Validation

Documentation only; the relevant gates were run to confirm the tree is unchanged: `pnpm lint` (0 errors), `pnpm typecheck`, `pnpm test` (40/40 — no event tests exist in the repo; see §1 "Tests" rows), `pnpm build`, backend `npm run verify` (boundaries 0/0, routes 65/65, providers ✓).
