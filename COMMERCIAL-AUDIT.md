# Commercial Readiness Audit — shop-starter-kit

**Date:** 2026-09-08
**Repo:** `shop-starter-kit` (branch `main`, last commit `d7ff140`, 2026-07-09)
**Scope:** Is this sellable today as a productised e-commerce build to paying clients in Cyprus?
**Method:** Read-only source audit. Every claim below cites a file. No feature assumed from a route, folder or model existing.

**Status scale:** WORKING (verified end-to-end) · PARTIAL (some layers missing) · UI ONLY (no backend) · MISSING · UNKNOWN

---

## 1. Verdict

**No. Not sellable today.**

The codebase is well-built for what it does — clean NestJS modules, real server-side price calculation, capability-based RBAC, refresh-token rotation, cache invalidation on write. But it is a *storefront demo*, not a *product a Cypriot shop can trade on*.

Three categories of hole:

- **Legal** — zero VAT anywhere in schema/order/display, no invoice or receipt, no privacy/terms/returns page, no cookie consent. An EU B2C store cannot legally trade.
- **Money lifecycle** — the Stripe webhook is not idempotent, so a duplicate event double-awards loyalty points; stock decrements before payment and is never returned on abandon or cancel; there is zero refund capability at any layer.
- **Operability** — the admin cannot open an order to see what was bought or where to ship it; the CSV import button is a no-op stub that silently discards the file; production images 404 because MinIO is unrouted; the production boot script re-creates `admin@demo.com` / password `admin` on every restart.

Zero tests, zero CI, zero backups, and no `DEPLOY.md` despite the README linking one.

**Roughly 236–325 developer-hours stand between this and a store an owner can run alone.**

---

## 2. Feature inventory

| Feature | Status | Files | Gap |
|---|---|---|---|
| Catalogue browsing | **WORKING** | `backend/src/products/products.service.ts`, `app/pages/products/index.vue`, `app/pages/products/[slug].vue` | Paginated 12/page, Redis-cached with TTL, category tree resolves children |
| Search | **PARTIAL** | `backend/src/products/products.service.ts:50-56` | `contains` ILIKE on `nameEl`/`nameEn` only. No description/brand search, no index (seq scan), no accent folding, no typo tolerance |
| Filtering | **WORKING** | `backend/src/products/products.service.ts:32-62`, `app/components/filters/ProductFilters.vue`, `app/stores/filters.ts` | Category/brand/price/onSale/sort all wired |
| Product variants (size, colour) | **MISSING** | `backend/prisma/schema.prisma:88-115` | No variant model. One price, one stock, one SKU per product. Cart/order/admin all assume it |
| Stock handling | **PARTIAL — broken lifecycle** | `backend/src/orders/orders.service.ts:89-96`, `backend/src/admin/admin.service.ts:134-138` | Atomic decrement is correct. But decrement happens **at order creation, before payment**. Abandoned Stripe checkouts hold stock forever. `updateOrderStatus` → `CANCELLED` does **not** restock. No expiry/reservation. Inventory drifts permanently downward |
| Cart | **WORKING** | `app/stores/cart.ts`, `app/components/cart/CartDrawer.vue` | Persisted client-side, prices re-verified server-side at order |
| Checkout | **PARTIAL** | `app/pages/checkout/index.vue`, `backend/src/orders/orders.service.ts` | Works, but the frontend **hardcodes** `subtotal >= 50 ? 0 : 5` shipping (`:206`) and `points/100` loyalty (`:213`). Backend reads these from admin settings. Owner changes shipping → displayed total ≠ charged total |
| Order placement | **WORKING** | `backend/src/orders/orders.service.ts:70-142` | Transactional, server-side totals, guest checkout supported |
| Order status | **PARTIAL** | `backend/src/admin/admin.service.ts:134`, `app/pages/account/orders.vue` | Status changes save. No customer email on status change, no tracking number field, no cancel side-effects |
| Customer accounts | **WORKING** | `backend/src/auth/auth.service.ts`, `app/pages/login.vue` | JWT + refresh rotation in Redis, Google OAuth, guest→user order linking. No email verification |
| Password reset | **WORKING** | `backend/src/auth/auth.service.ts:163-187`, `backend/src/mail/mail.service.ts:78` | Redis token, 1h TTL, sessions invalidated on reset. Verified end-to-end |
| Favourites | **PARTIAL** | `backend/src/favourites/favourites.service.ts`, `app/pages/account/favourites.vue` | Toggle/list work. Service returns **raw MinIO keys**, never presigned → favourite product images 404, fall back to placeholder |
| Loyalty points | **PARTIAL** | `backend/src/orders/orders.service.ts:111-134`, `backend/src/payments/payments.service.ts:128-141` | Earn/redeem work. Points are **debited at order creation** — an abandoned Stripe order destroys them with no refund path. Duplicate webhook double-credits |
| Transactional email | **PARTIAL** | `backend/src/mail/mail.service.ts` | Only 3 templates: reset, order confirmation, newsletter welcome. **All hardcoded English** in a bilingual shop. No shipped/status/refund/invoice mail. Order confirmation fires at creation — unpaid Stripe orders get "confirmed" |
| Admin product CRUD | **PARTIAL** | `backend/src/admin/admin.service.ts:218-269`, `app/components/admin/ProductDrawer.vue` | Create/update/deactivate work. **No DTO, no class-validator** — `Record<string, unknown>` cast straight to Prisma (violates the project's own rule). No hard delete. `getProductById` returns raw image keys → **existing photos invisible when editing** (`ProductDrawer.vue:83-85`) |
| Admin order management | **PARTIAL — unusable** | `app/pages/admin/orders/index.vue`, `backend/src/admin/admin.service.ts:130-138` | List + status dropdown only. **No order detail page exists.** `getOrders()` returns no line items, no customer, no shipping address. The admin physically cannot see what to pack or where to send it. No pagination (`<!-- Pagination placeholder -->`), loads every order |
| Roles / permissions | **WORKING** | `backend/src/auth/permissions.ts`, `backend/src/auth/guards/permissions.guard.ts`, `backend/src/staff/staff.service.ts` | Capability-based, server-enforced, untagged routes default owner-only, last-owner lockout guard. Best-built part of the app |
| Discount / coupon codes | **MISSING** | — | No model, no endpoint, no UI. Only a `// coupons (future)` comment at `permissions.ts:16` |
| Product reviews / ratings | **MISSING** | — | No model |
| Analytics dashboard | **PARTIAL** | `backend/src/analytics/analytics.service.ts`, `backend/src/admin/admin.service.ts:69-76` | The analytics module is real. But the dashboard's "Top 5 Products" reads `orderItem.findMany({ take: 500 })` **with no `orderBy`** — silently wrong past 500 line items ever sold |
| Low-stock notifications | **WORKING** | `backend/src/notifications/notifications.service.ts` | De-duplicated, escalates low→out, auto-resolves on restock. Threshold hardcoded at 10 |
| Newsletter | **WORKING** | `backend/src/newsletter/newsletter.service.ts`, `app/pages/unsubscribe.vue` | Subscribe, welcome mail, unsubscribe, CSV export of subscribers |

---

## 3. Payments

**Providers implemented: Stripe only.** Plus two non-electronic methods (`CASH_ON_PICKUP`, `CARD_ON_PICKUP`) that settle instantly with no gateway.

### No interface, no adapter, no strategy

The Stripe SDK is instantiated directly in the service constructor (`payments.service.ts:16`) and the provider name is baked into the database schema, the DTOs, and the frontend.

Every file referencing a payment provider by name:

| File | How |
|---|---|
| `backend/src/payments/payments.service.ts` | `import Stripe from 'stripe'`, `new Stripe(...)`, sessions/coupons/webhooks API |
| `backend/src/payments/payments.controller.ts` | `stripe-signature` header |
| `backend/src/orders/orders.service.ts:123` | `if (dto.paymentMethod !== 'STRIPE')` drives the entire settle-now vs settle-on-webhook branch |
| `backend/src/orders/dto/create-order.dto.ts` | `PaymentMethod` enum validation |
| `backend/prisma/schema.prisma` | `enum PaymentMethod { STRIPE ... }`, `stripePaymentIntentId`, `stripeSessionId` columns |
| `backend/src/app.module.ts:36-37` | Joi marks `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` **required** — the backend will not boot without Stripe even for a cash-only shop |
| `app/pages/checkout/index.vue` | `payment_method: 'stripe'`, `/payments/create-checkout` |
| `app/pages/checkout/success.vue` | `/payments/verify-session` |
| `app/plugins/stripe.client.ts` | `loadStripe` |
| `nuxt.config.ts:74-80` | `stripeSecretKey`, `stripeWebhookSecret`, `stripePublishableKey` |
| `types/index.ts`, `i18n/en.json`, `i18n/el.json`, `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example` | Enum values, labels, env plumbing |

### Adding JCC Payment Gateway — estimate

**24–40 hours** of code, plus JCC merchant onboarding lead time (external, typically weeks).

JCC is a hosted redirect gateway with its own HMAC signature scheme and a browser-return callback, rather than Stripe's server-to-server webhook-first model. The abstraction has to cover *both* shapes — this is not an SDK swap.

Files that must change:

- **New:** `payments/payment-provider.interface.ts`, `payments/stripe.provider.ts`, `payments/jcc.provider.ts`, `payments/payment.factory.ts`
- `payments.service.ts` — gut and re-front the interface (~8h alone)
- `payments.controller.ts` — per-provider callback routes, signature header abstraction
- `payments.module.ts` — provider registration
- `orders.service.ts:123` — replace `!== 'STRIPE'` with `isDeferredSettlement(method)`
- `create-order.dto.ts` — enum
- `schema.prisma` + **new migration** — add `JCC` to `PaymentMethod`, generalise `stripePaymentIntentId`/`stripeSessionId` into `providerRef`/`providerSessionId`, add `paymentProvider`
- `app.module.ts` — make Stripe env conditional, add JCC vars
- `checkout/index.vue`, `cancel.vue`, `success.vue` — options, retry, verify
- `types/index.ts`, `i18n/el.json`, `i18n/en.json`, `.env.example`, both compose files

### Webhook idempotency — NOT idempotent

`payments.service.ts:88-146`. Signature verification is correct. Everything after it is not.

There is no processed-event table, no `event.id` dedupe, and no guard on the order's current state. On a **duplicate `checkout.session.completed`** — which Stripe explicitly warns can happen, and which its retry policy makes likely after any 5xx or timeout — the handler runs the full block again: the order is re-updated (harmless) and **a second `LoyaltyTransaction` is created and the user's `loyaltyPoints` incremented again** (`:132-140`).

Points are real money at checkout. Two deliveries = free money, silently, with no log.

**Out-of-order events:** only `checkout.session.completed` is handled at all. `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded` and `charge.dispute.created` all fall through to `return { received: true }` at `:98`. So `PaymentStatus.FAILED` and `PaymentStatus.REFUNDED` exist in the schema and are **never written by any code path**.

Also missing: **no idempotency key** on `sessions.create` (`:62`) — a double-click on Place Order creates two Stripe sessions for one order. This directly violates the project's own rule in `.claude/CLAUDE.md` ("Use idempotency keys on payment creation").

Minor: `paidCents < orderCents` accepts overpayment silently (`:111`); loyalty coupons are created on the Stripe account unbounded and never cleaned up (`:54`); line items always use `nameEn`, so Greek customers see English product names on the Stripe page (`:35`).

### Refunds, partial refunds, failed payments — MISSING entirely

A grep for `refund` across all source returns exactly one hit: a comment at `permissions.ts:11`.

No Stripe refund call, no admin endpoint, no UI, no restock-on-refund, no `charge.refunded` handler. A shop owner who needs to refund a customer must do it in the Stripe dashboard, and the order in their own admin will still read `PAID`. Failed payments are equally invisible — the order sits at `PENDING` forever with its stock consumed.

---

## 4. Shipping, tax and invoicing

### Shipping — PARTIAL, one flat rate

`orders.service.ts:61-64` supports exactly: pickup = free, else `subtotal >= free_shipping_threshold ? 0 : shipping_cost`. Both values are admin-editable. That is the whole system.

| Capability | Status |
|---|---|
| Shipping zones | **MISSING** — no zone/region model. Cyprus-wide flat rate only |
| Weight-based rates | **MISSING** — `Product` has no weight or dimension field |
| Price-based rates | **PARTIAL** — one threshold, one price. No tiers |
| Free-shipping threshold | **WORKING** — but the checkout page ignores the setting (see §2) |
| Pickup | **WORKING** — forces cost to 0, unlocks cash/card-on-collection |

### Courier integration — MISSING

No ACS, no Cyprus Post, no DHL, no tracking number field on `Order`, no label generation, no shipment webhook. The owner copies the address out of the database by hand — except they cannot, because the admin order list does not display addresses.

### VAT — MISSING, completely

This is the single largest legal gap. There is no `vatRate`, `vatAmount`, `netAmount`, or `grossAmount` anywhere in `schema.prisma` — not on `Product`, not on `Order`, not on `OrderItem`. Nothing computes it, nothing stores it per line, nothing displays it. `Order` has `subtotal`, `shippingCost`, `loyaltyDiscount`, `total` and nothing else.

A Cypriot VAT-registered business (mandatory above €15,600 turnover) must show VAT-inclusive prices to consumers and issue documents stating the VAT rate and amount. **This build cannot produce that number at all.**

### Invoice / receipt — MISSING

No PDF generation, no invoice model, no sequential legal numbering, no storage, no attachment. The only order document that exists is a ~40-word HTML email reading "Your order #A1B2C3D4 has been confirmed" (`mail.service.ts:88-95`) with no line items, no prices, no VAT, and no business registration details.

### Terms / returns / privacy / cookie consent — MISSING, all four

A grep across `app/` and `i18n/` for `privacy|terms|cookie.?consent|gdpr|returns policy` returns zero application hits. There is no `/privacy`, `/terms`, `/returns` or `/cookies` route, no consent banner component, no consent state, and no analytics gating. The existing static pages are only `about.vue`, `contact.vue` and `brands.vue`.

Under GDPR and the ePrivacy directive this store cannot lawfully launch. Compounding it, `nuxt.config.ts:13-30` hotlinks **Google Fonts** and **cdnjs** on every page load, transmitting EU visitor IPs to third-party CDNs before any consent is possible — the exact pattern fined in *LG München 3 O 17493/20*.

---

## 5. Time-to-launch for a NEW client

### Every step, clean machine → live site

**Local setup (mostly automated)**

1. Install Docker, Docker Compose, Node 22, pnpm — *manual*
2. `git clone <repo>` — *manual*
3. `cp .env.example .env` — *manual*
4. Edit `.env`: `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DATABASE_URL`, `REDIS_PASSWORD`, `REDIS_URL`, `JWT_SECRET` (≥32 chars), `JWT_REFRESH_SECRET` (≥32), `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`, `MINIO_PUBLIC_URL`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `BRAND_NAME`, `BRAND_COLOR`, `BRAND_LOGO_URL`, `SITE_URL`, `NUXT_URL`, `NUXT_PUBLIC_API_BASE`, `NUXT_PUBLIC_SITE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` — **25 variables, all manual**
5. `docker compose up -d` — *automated*
6. Migrations + seed run automatically via `start.sh` — *automated, see the security warning below*

**Rebranding (all manual code edits)**

7. Edit `app/utils/business.ts` — name, legal name, tagline, phone, WhatsApp, full address, geo lat/lon, timezone, opening hours ×2 formats, social links
8. Edit `app/assets/css/brand.css` — 17 colour tokens
9. Replace `public/favicon.svg`, `public/og-image.png`, `public/apple-touch-icon.png`
10. Delete stale pet assets in `app/assets/images/` (`Dog-Image.png`, `Cat-Image.png`, `Bird-Image.png`, `Rodent-Image.png`, `PetShop-HeroImage.png`)
11. Edit `nuxt.config.ts:25` if the brand uses different fonts
12. Translate/replace both `i18n/el.json` and `i18n/en.json` — 480 lines each, 26 top-level sections
13. Rewrite `about.vue` and `contact.vue` copy
14. Fix the `royal-canin-adult` slug placeholder at `ProductDrawer.vue:32`
15. **Write privacy, terms, returns and cookie pages from scratch** — they do not exist

**External accounts (manual, with third-party lead time)**

16. Stripe account + business verification, live keys, webhook endpoint registered at `https://<domain>/api/payments/webhook`, copy `whsec_`
17. Resend account, add domain, publish SPF + DKIM + DMARC DNS records, wait for verification
18. Google Cloud project + OAuth consent screen + credentials + authorised redirect URI (only if Google login is wanted)

**Production deploy (mostly manual)**

19. Provision VPS, harden SSH, install Docker
20. DNS: `A` record for apex + `www` → VPS IP
21. **Obtain TLS certs manually** and place `fullchain.pem` + `privkey.pem` in `docker/nginx/ssl/` — there is **no certbot service** in `docker-compose.prod.yml`; nginx mounts the directory read-only and expects the files to exist
22. **Set up certificate renewal yourself** — nothing in the repo does this. Let's Encrypt expires at 90 days and the site goes down
23. **Add an nginx `location` block for MinIO** — `docker/nginx/nginx.conf` has no MinIO route and `docker-compose.prod.yml` maps no MinIO port. Presigned image URLs are unreachable, so **every product photo 404s in production out of the box**
24. Fix `docker-compose.prod.yml:88`: `NUXT_PUBLIC_STRIPE_KEY` does not map to `public.stripePublishableKey` (Nuxt would need `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
25. Add the missing `NUXT_PUBLIC_SITE_URL` to the prod compose — without it `siteUrl` falls back to `http://localhost:3000`, so schema.org JSON-LD and `og:image` publish localhost URLs to Google and Facebook
26. `docker compose -f docker-compose.prod.yml up -d --build`

> ### ⚠️ Security — must be done before the site is reachable
>
> `backend/start.sh` runs `node dist/seed.js` unconditionally on **every container start**, and `prisma/seed.ts:19-45` upserts `admin@demo.com` with password `admin` at role `ADMIN`, plus `user@demo.com` / `user`.
>
> Because these are upserts keyed on email, **deleting the account does not help — the next deploy or restart recreates it.** Any live store built from this kit ships with a publicly-guessable administrator login.
>
> Gate the seed behind an explicit env flag and strip the demo users before a single client instance is exposed.

27. Register the Stripe webhook against the live domain, send a test event, confirm 200
28. Create the real owner account; delete the demo users (again)
29. Enter the catalogue — **by hand, one product at a time** (see §7)
30. Smoke test: browse, search, add to cart, guest checkout, Stripe test card, webhook fires, order appears, email arrives

### Automated vs manual

**6 of ~30 steps are automated** (`docker compose up`, migrations, seed, bucket creation, and the two builds). Everything else is manual.

There is no bootstrap script, no `setup.sh`, no CLI, no config generator, and no secret generator. And the README's deployment instruction is: *"See DEPLOY.md for the complete step-by-step production deployment guide."* — **`DEPLOY.md` does not exist in the repository.** The one artefact that would make this repeatable is missing.

### Total hours, one developer who knows this codebase

**16–24 hours** for a functioning deployment, assuming Stripe/Resend/DNS accounts already exist and no catalogue entry.

Realistically **3–5 working days** including DNS/DKIM propagation, TLS, discovering the MinIO routing problem, and the first 100 products.

That is against a target of **under 8 hours**.

### Only changeable by editing code, not config

- Business identity, address, phone, hours, socials → `app/utils/business.ts`
- All brand colours → `app/assets/css/brand.css`
- Nuxt UI primary colour → `app/app.config.ts`
- Fonts → `nuxt.config.ts`
- Available languages → `nuxt.config.ts:62-71` + new JSON file
- Every UI string → `i18n/*.json`
- Low-stock threshold (10) → `notifications.service.ts:6`
- Dashboard low-stock threshold (5) → `admin.service.ts:78`
- Products per page (12) → `products.service.ts:9`
- Admin page size (20) → `admin.service.ts:141`
- Checkout shipping/loyalty display values → `checkout/index.vue:206-213`
- Loyalty redemption cap (5000) → `checkout/index.vue:210`
- Currency (EUR hardcoded) → `payments.service.ts`, `useCurrency.ts`, and `€` literals across admin templates
- Static page copy → `about.vue`, `contact.vue`
- All email templates → `mail.service.ts`

---

## 6. Rebranding

**Config/env alone: no.**

Partial credit — the *email* layer is genuinely env-driven (`BRAND_NAME`, `BRAND_COLOR`, `BRAND_LOGO_URL` at `mail.service.ts:20-30`), and `brand.css` is a real single-source palette with a comment inviting exactly this. But the storefront reads none of it from config.

| Asset | Config-able? | Must hand-edit |
|---|---|---|
| Name | ✗ | `app/utils/business.ts:4-5` (`BRAND_NAME` env covers emails only) |
| Logo | ✗ | `business.ts:9-13`, `BrandLockup.vue`, `BrandWordmark.vue`, `public/favicon.svg`, `public/og-image.png`, `public/apple-touch-icon.png` |
| Colours | ✗ | `brand.css` (17 tokens), `app.config.ts`, `BRAND_COLOR` env for email — **duplicated by design, drifts silently** |
| Fonts | ✗ | `nuxt.config.ts:25` |
| Currency | ✗ | Hardcoded `'eur'` at `payments.service.ts:32,46,56`, `€` literals in `admin/index.vue`, `admin/orders/index.vue:71`, `account/orders.vue`, `useCurrency.ts` |
| Locale | ✗ | `nuxt.config.ts:62-71` + new i18n file + `'el-GR'` hardcoded at `admin/orders/index.vue:45` |
| Legal pages | ✗ | **Do not exist** — must be authored |
| Contact / address / hours | ✗ | `business.ts:18-49` |
| Social links | ✗ | `business.ts:14` |

### Hardcoded strings and remnants found

**Pet-shop remnants** — the de-pet refactor (commit `152a9a1`) was thorough. What survives:

- `ProductDrawer.vue:32` — `placeholder="royal-canin-adult"`
- `app/assets/images/` — `Dog-Image.png`, `Cat-Image.png`, `Bird-Image.png`, `Rodent-Image.png`, `PetShop-HeroImage.png` still on disk
- `.env.example` — `DB_USER=petshop`, `DB_NAME=petshop`, `MINIO_BUCKET=petshop-images`, `MINIO_ROOT_USER=petshop`
- `docker-compose.prod.yml` — every `container_name: petshop_*`, and `${DB_USER:-petshop}` / `${MINIO_BUCKET:-petshop-images}` defaults
- Root `package.json:2` — `"name": "petshopcy"`
- `.claude/CLAUDE.md` — titled "PetShopCY Tech Stack Rules"

**Real personal data in the working tree:** `app/utils/business.ts:18-20` carries a live Cyprus mobile — `+357 99 584 273` / `wa.me/35799584273` — wired to the floating WhatsApp button on every page. Ship without changing it and the client's customers message *you*.

**Hardcoded Greek in the admin panel** (not i18n'd, so an English-speaking owner gets a Greek back office):

- `admin/index.vue` — the entire dashboard: "Συνολικά Έσοδα", "Έσοδα Μήνα", "Πελάτες", "Νέοι Μήνα", "Τελευταίες 30 ημέρες", "Top 5 Προϊόντα", "Παραγγελίες ανά Κατάσταση", "Χαμηλό Απόθεμα", "Πρόσφατες Παραγγελίες", "Δεν υπάρχουν δεδομένα"
- `admin/orders/index.vue` — "Αναζήτηση παραγγελίας…", "Όλες οι πληρωμές", "Πληρωμένες", "Εκκρεμείς", "Αποτυχημένες", "Τύπος", "Πληρωμή", "Παραλαβή", "Αποστολή", "Δεν βρέθηκαν παραγγελίες", "παραγγελίες"
- `admin/products/index.vue` — "Κατάσταση", "Ενέργειες", "Δεν βρέθηκαν προϊόντα", `Απενεργοποίηση "..."`

Mixed with hardcoded **English** in the same screens: `"Search products, brands…"`, `"Order ID"`, `"Import CSV"`, `"CSV format: slug, name_el, ..."`.

**Other:** `you@example.com` at `login.vue:155` and `forgot-password.vue:21`; `orders@example.com` at `nuxt.config.ts:77`; an OpenStreetMap embed with hardcoded coordinates at `contact.vue:106`.

---

## 7. Client self-sufficiency

Assume a non-technical shop owner.

| Task | Owner alone? | Evidence |
|---|---|---|
| Add / edit products | ⚠️ **Mostly** | `ProductDrawer.vue` works, but no input validation — a bad price or duplicate slug returns a raw 500 |
| Upload product photos | ⚠️ **Half-broken** | Upload works. But re-opening a saved product shows filename text instead of thumbnails — `admin.getProductById` (`admin.service.ts:212-216`) returns raw MinIO keys, never presigned, so `ProductDrawer.vue:83-85` falls through to the text fallback. The owner cannot tell which photos a product already has |
| Manage categories | ✅ **Yes** | `admin/categories/index.vue` — full CRUD, 2-level nesting, delete guarded |
| Change prices | ✅ **Yes** | Product drawer |
| Manage stock | ✅ **Yes** | Product drawer + low-stock notifications |
| **Create discount codes** | ❌ **Impossible** | Feature does not exist at any layer |
| View orders | ⚠️ **List only** | Sees ID, date, type, payment badge, status, total. **Cannot see what was ordered, by whom, or the delivery address** — no detail page exists, and `getOrders()` returns no items or address. The shop cannot be fulfilled from this screen |
| Update order status | ✅ **Yes** | Dropdown at `admin/orders/index.vue:63` — but cancelling silently fails to restock, and no email is sent to the customer |
| **Issue refunds** | ❌ **Impossible** | No code. Must use the Stripe dashboard; the local order will still show `PAID` forever |
| **Edit homepage content** | ❌ **Developer** | `index.vue` is hardcoded Vue + i18n keys. No CMS, no blocks, no hero editor |
| **Edit static pages** | ❌ **Developer** | `about.vue` / `contact.vue` are Vue components |
| **Add a language string** | ❌ **Developer** | Requires editing `i18n/el.json` + `i18n/en.json` and redeploying |
| **Change shipping cost** | ⚠️ **Trap** | The setting saves and the backend honours it — but the checkout page still *displays* the hardcoded €5/€50. The customer is shown one total and charged another |
| Change loyalty rates | ⚠️ **Same trap** | Same mismatch at `checkout/index.vue:213` |
| Manage staff / roles | ✅ **Yes** | `admin/staff/index.vue` + `staff.service.ts` — genuinely good |
| Export newsletter list | ✅ **Yes** | `admin/newsletter/index.vue:64` |

**Silently requires a developer:** discount codes, refunds, homepage and static-page copy, any new or corrected translation, VAT, invoices, shipping rules beyond one flat rate, seeing an order's contents, bulk product entry, adding a language, currency.

---

## 8. Bulk data

### CSV import — UI ONLY, and it lies

`admin/products/index.vue:10-12` renders an "Import CSV" button. `:109-120` opens a modal documenting the format (`slug, name_el, name_en, price, stock, brand, category_slug`) with a file picker and an Import button.

Here is the entire handler (`admin/products/index.vue:229-235`):

```js
async function importCsv() {
  if (!csvFile.value) return
  showCsvUpload.value = false
  csvFile.value = null
  refresh()
}
```

It closes the modal, discards the file, and refreshes the list. No parsing, no upload, no request. There is **no import endpoint** in `admin.controller.ts`.

The owner picks their file, clicks Import, sees the modal close and the table reload — and concludes it worked. This is worse than a missing feature: it fails silently and looks successful.

### Export — MISSING

Only newsletter subscribers can be exported (`newsletter/index.vue:64`). No product export.

### Bulk image upload — PARTIAL

`ProductDrawer.vue:207-232` accepts multi-select and drag-drop, uploading sequentially — but only *within one already-open product*. There is no library, no bulk-assign, and no filename-to-SKU matching.

### How products are entered today

One at a time through the drawer — slug, Greek name, English name, Greek description, English description, price, compare-at, cost, stock, brand, category, active flag, then per-image upload. Twelve-plus fields, half needing bilingual copy.

**100 products, realistically:** at 4–6 minutes each with copy already written and images already cropped, **7–10 hours of uninterrupted data entry**. With bilingual copywriting and image prep, **20–30 hours**.

That single fact defeats the "live in under 8 hours" goal on its own.

---

## 9. Operations and risk

### Automated tests — none. Zero.

A repo-wide search for `*.spec.ts`, `*.test.ts`, `*.e2e-spec.ts`, `jest.config*`, `vitest.config*`, `playwright.config*` returns **no files**. `backend/package.json` has no `test` script and no test dependency — no Jest, no Vitest, no Supertest. Root `package.json` likewise.

**Real coverage: 0%.** Nothing guards the money paths — order totals, loyalty arithmetic, stock decrement, webhook handling, permission checks — all untested.

### CI/CD — none

No `.github/`, no `.gitlab-ci.yml`, no Jenkinsfile, no Drone. Only three YAML files exist and all three are compose files. No automated lint, build, test or deploy. Deployment is `git pull` + `docker compose up -d --build` by hand over SSH.

### Database backups — none, and no restore has ever been tested

No `pg_dump` anywhere, no backup container, no cron, no volume snapshot config, no retention policy, no offsite target. `docker-compose.prod.yml` declares `postgres_data` as a plain local Docker volume.

A corrupted volume or a lost droplet loses every order, customer and product permanently. **This is the highest-severity operational finding in the audit.**

### Uptime monitoring — none. Error tracking — none.

No Sentry, no Rollbar, no Prometheus, no Grafana, no UptimeRobot config. `health.controller.ts` exposes `/health` but it **only pings Postgres** — Redis, MinIO and Stripe are unchecked, so a health probe reports green while images are down.

Logging is `nestjs-pino` to stdout with cookie/auth redaction (`app.module.ts:48-54`) — but nothing ships or retains those logs. When a customer reports a failed checkout, there is no way to find out why.

### Dependency failure behaviour

| Service down | Result |
|---|---|
| **Redis** | **Browsing survives; login breaks.** `redis.service.ts` wraps every call in try/catch and degrades to cache-miss — good design. But refresh-token state lives *only* in Redis (`auth.service.ts:151`): `exists()` returns `false` on failure → **every token refresh throws "Refresh token revoked"** → every logged-in customer is signed out and cannot sign back in for longer than the 15-minute access token. Password reset tokens (`:169`) are also Redis-only, so reset silently stops working — the email sends, the link always says expired |
| **MinIO** | **All product images break.** Presigned URL generation is `await`ed inline at `products.service.ts:79,118,149` with **no try/catch** — a MinIO outage throws inside `findAll`/`findBySlug`, so the product list and detail endpoints return 500. The catalogue does not degrade to placeholders; **it goes down entirely.** Admin image upload also fails |
| **Mail (Resend/SMTP)** | **Degrades quietly.** All sends are fire-and-forget with `.catch()` (`orders.service.ts:144`, `mail.service.ts:85,94,104`). Orders still complete. But there is **no retry and no queue** — a mail outage means those order confirmations and password resets are lost forever, with only a log line |
| **Stripe** | Checkout unavailable; cash/card-on-pickup still work. The backend **will not boot at all** without `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (`app.module.ts:36-37`) |
| **Postgres** | Total outage. Correctly gated by the compose healthcheck |

### External services and monthly cost, ONE store

| Service | Purpose | Cost / month |
|---|---|---|
| VPS (Hetzner CX32 or equiv., 4 vCPU / 8 GB) | Runs all 7 containers | **€8–15** |
| Domain | — | **~€1** (€12/yr) |
| Let's Encrypt | TLS | **€0** (manual, unautomated) |
| Resend | Transactional email | **€0** free ≤3k/mo, then **~€18** |
| Stripe | Payments | **variable** — 1.5% + €0.25 per EEA card; ≈**€90** at €5k GMV |
| MinIO / Postgres / Redis | Self-hosted, in-VPS | **€0** |
| Offsite backups *(not built)* | — | **~€4** when added |
| Error tracking *(not built)* | — | **€0** Sentry free tier |
| Uptime *(not built)* | — | **€0** UptimeRobot free |

**Fixed infrastructure, one store: €10–20/month.** Add ~€90/month in Stripe fees at €5k monthly turnover.

Not counted: your own operations time, which today is the dominant real cost because nothing is monitored or backed up.

---

## 10. Multi-store architecture

**Single-tenant. One deployment per client, unambiguously.**

There is no `Store`, `Tenant` or `Organization` model in `schema.prisma`, no `storeId` on any of the 11 models, no tenant resolution middleware, no domain→tenant mapping, and no row-level scoping in any query. Every `prisma.product.findMany()` returns *the* catalogue.

Configuration is per-process env plus per-build source edits (`business.ts`, `brand.css`), which alone forecloses multi-tenancy — two brands cannot share one build.

### 10 client stores on the current architecture

10 separate VPS instances × 7 containers each. Each store needs its own Postgres, Redis, MinIO, backend, Nuxt, nginx and certificates.

- 10 × €8–15 VPS = **€80–150/month**
- 10 × €1 domain = **€10/month**
- Resend, consolidated on one account = **€18–20/month**
- **≈ €110–180/month** in infrastructure

The infrastructure is the cheap part. The real cost is operational: 10 separate certificate renewals (none automated), 10 manual `git pull` deploys per patch, 10 databases with no backups, 10 sets of secrets, and a rebrand that lives in source control — so a shared bugfix means 10 builds and 10 deploys, each an opportunity to break one client's customisations.

### To run several stores from one deployment

Minimum changes:

- Add a `Store` model and a `storeId` FK on `Product`, `Category`, `Order`, `Setting`, `Notification`, `NewsletterSubscriber` (users likely stay global or gain a join table)
- Write tenant-resolution middleware keyed on `Host` and thread a tenant context through every service
- Scope all ~40 queries, and add `storeId` to every Redis cache key — currently global (`products.service.ts:25`), so it would leak store A's catalogue to store B
- Move branding, business details, palette and content out of source into per-store DB rows, served at runtime
- Namespace MinIO by store prefix
- Hold per-store Stripe credentials in the database rather than env
- Add wildcard TLS plus per-domain routing

Realistically a **150–250 hour rearchitecture**, and it should be decided *now* — every hour spent hardening the single-tenant path is partly rework if multi-tenancy is the destination.

---

## 11. Debt and blockers

**No TODO/FIXME/HACK comments anywhere.** The source is clean of annotations — the gaps are structural, not marked. That is worth knowing: reading the code gives no warning about what is missing.

### Bugs confirmed by reading the code

1. **Webhook double-credits loyalty** on duplicate Stripe delivery — `payments.service.ts:128-141`
2. **Stock never returns.** Decremented pre-payment (`orders.service.ts:91-94`); `CANCELLED` does not restock (`admin.service.ts:134-138`); no `checkout.session.expired` handler
3. **Loyalty points destroyed on abandoned checkout** — debited at creation (`orders.service.ts:111-119`), never refunded
4. **Checkout displays wrong totals** when the owner changes shipping/loyalty settings — `checkout/index.vue:206-213`
5. **Customer order history shows blank product names.** `account/orders.vue:91-92,104` reads `item.product.images[0]` and `item.product.name_el`, but `findByUser` (`orders.service.ts:159-176`) never includes the `product` relation — it selects the `productName` snapshot the UI ignores
6. **"Buy again" always produces an empty cart** — `account/orders.vue:181` filters on `i.product && i.product.stock > 0`, and `i.product` is always undefined
7. **CSV import is a no-op** — `admin/products/index.vue:229`
8. **Admin cannot see existing product photos** — raw keys, never presigned (`admin.service.ts:212-216`)
9. **Favourites images 404** — `favourites.service.ts:8-14` returns raw keys
10. **"Top 5 Products" is wrong past 500 line items** — `take: 500` with no `orderBy` (`admin.service.ts:69-76`)
11. **Order confirmation email sent for unpaid Stripe orders** — fired at creation (`orders.service.ts:144`), before the webhook confirms payment
12. **Production images 404** — no MinIO route in `nginx.conf`, no port in `docker-compose.prod.yml`
13. **`NUXT_PUBLIC_STRIPE_KEY` misnamed** — `docker-compose.prod.yml:88` never reaches `public.stripePublishableKey`
14. **`NUXT_PUBLIC_SITE_URL` missing in prod** → schema.org and `og:image` emit `http://localhost:3000` publicly
15. **Missing settings row → `NaN` total.** `orders.service.ts:29` `parseFloat(undefined)` propagates into `total` with no guard
16. **Admin order list unpaginated** — loads every order ever (`admin.service.ts:130`)
17. **nginx rate limit 30 req/min per IP** (`nginx.conf:20`) — customers behind carrier NAT will hit 503s during normal browsing
18. **No CSP header** despite the README advertising one — `nginx.conf:39-42` sets four headers, none of them CSP

### Dead code and config

- `NUXT_PUBLIC_WHATSAPP_NUMBER` (`docker-compose.prod.yml:89`) is never read — `WhatsAppButton.vue:20` uses the hardcoded `BUSINESS.whatsapp`
- Root `package.json` ships `stripe`, `resend` and `zod` server SDKs, and `nuxt.config.ts:74-76` declares `stripeSecretKey`/`stripeWebhookSecret`/`resendApiKey` — but the Nuxt app has **no `server/` directory**. All unused
- `PaymentStatus.FAILED` and `PaymentStatus.REFUNDED` are never written by any code path
- `tree.txt` — a **27 MB** file in the working tree
- `schema-dump.txt`, `mkadmin.js` — throwaway artefacts (gitignored, but present in any copied delivery)
- Stale pet imagery in `app/assets/images/`

### Dependency state

Nothing unmaintained, but the versions drift:

- README claims "Nuxt 3"; `package.json` pins `nuxt ^4.4.2` — the docs describe a different major version than ships
- `stripe ^17` (root, unused) vs `^18` (backend)
- `zod ^4` (root) vs `^3` (backend)
- `resend ^6` (root, unused) vs `^4` (backend)
- `file-type ^16.5.4` (backend) — several majors behind current
- `Dockerfile.nuxt:6` uses `npm install`, not `npm ci` — production builds are not reproducible (the backend Dockerfile correctly uses `npm ci`)
- Last commit `2026-07-09`; today `2026-09-08` — **two months stale**, no dependency refresh since

### Secrets and credentials

**Good news first: no secrets are committed to git.** `.env` and `backend/.env` are gitignored and untracked; `git log --all --diff-filter=A` shows only `.env.example` was ever added, and it contains placeholders (`change_me_*`, `sk_test_...`) throughout.

But two credential problems exist in the delivered tree:

1. **`backend/prisma/seed.ts:19-45` + `backend/start.sh:5`** — the production entrypoint runs the seed on every container start, upserting `admin@demo.com` / `admin` at role `ADMIN` and `user@demo.com` / `user`. Deleting them is futile; the next restart restores them. **Any store deployed as-is has a publicly-known admin login.**
2. **`mkadmin.js`** — contains a real personal address (`konszogr@hotmail.com`) and a hardcoded password (`!123456!`) creating an `ADMIN` user. It is gitignored, so a `git clone` delivery is clean — but a zip or folder-copy delivery hands the client a script that plants your account in their database.
3. **`app/utils/business.ts:18-20`** — your live personal phone number, wired to the site-wide WhatsApp button.

### Three things most likely to blow up on a real client site

1. **The seeded demo admin.** `admin@demo.com` / `admin` with full owner rights, recreated on every deploy. It is the first credential pair anyone tries. Full catalogue, customer-data and order compromise — and under GDPR that is a reportable breach for your client, traceable to your kit.

2. **Product images 404 in production.** MinIO has no nginx route and no exposed port in `docker-compose.prod.yml`. The build passes, the site loads, checkout works — and every product is a grey placeholder. You will discover this *after* the client's launch announcement, because nothing in dev reproduces it (dev compose maps port 9000).

3. **No backups, plus permanent stock drift.** Two silent failures compounding. Every abandoned Stripe checkout permanently removes stock that is never returned, so within weeks the catalogue reads "out of stock" on products sitting on the shelf and sales quietly stop. Meanwhile there is no `pg_dump` anywhere — so when a volume corrupts or a VPS is lost, every order, customer and product is gone with no recovery path, and no restore has ever been rehearsed.

**Honourable mention:** TLS certificates are placed by hand with no certbot and no renewal. **The site goes down 90 days after launch**, on a timer, for every client.

---

## 12. Blockers before first paid client

Ordered by severity.

| # | Blocker | Hours |
|---|---|---|
| 1 | Remove demo admin from seed; gate seed behind `SEED_DEMO_DATA` flag; strip `mkadmin.js` | **2** |
| 2 | Automated Postgres backups + offsite copy + **rehearsed restore** | **6** |
| 3 | Fix MinIO production routing (nginx location, `MINIO_PUBLIC_URL`, verify end-to-end) | **6** |
| 4 | VAT: schema migration, per-line storage, calculation, display, email, admin | **24** |
| 5 | Legal pages — privacy, terms, returns/withdrawal, cookie consent banner, self-host fonts | **16** |
| 6 | Legal invoice/receipt PDF with sequential numbering, stored + emailed | **16** |
| 7 | Stock/payment lifecycle: restock on cancel + `checkout.session.expired`, refund loyalty, reservation window | **12** |
| 8 | Refunds: Stripe API, partial, `charge.refunded` webhook, restock, admin UI | **12** |
| 9 | Admin order detail page — line items, customer, shipping address, notes | **12** |
| 10 | Webhook idempotency: `processed_events` table + unique constraint + state guard; idempotency key on session create | **4** |
| 11 | Fix checkout's hardcoded €5/€50 and `/100` — expose settings via public endpoint | **4** |
| 12 | Real CSV import: endpoint, parse, validate, dry-run, error report *(or delete the fake button — 0.5h)* | **12** |
| 13 | Certbot service + auto-renewal in `docker-compose.prod.yml` | **6** |
| 14 | Write the missing `DEPLOY.md` + a `setup.sh` bootstrap/secret generator | **6** |
| 15 | Tests + CI covering the money paths (orders, loyalty, stock, webhook, permissions) | **40** |
| 16 | Discount / coupon codes — model, validation, admin UI, checkout | **20** |
| 17 | Admin panel i18n — remove all hardcoded Greek/English | **10** |
| 18 | Fix customer order history + reorder (`product_name` snapshot) | **3** |
| 19 | DTOs + class-validator on admin product/category endpoints | **4** |
| 20 | Rebranding via config: business details, palette, currency, locale out of source | **8** |
| 21 | Error tracking (Sentry) + uptime monitoring + full health check (Redis, MinIO) | **4** |
| 22 | Order confirmation email only after payment confirms | **2** |
| 23 | Bilingual email templates | **6** |
| 24 | Prod compose fixes: `NUXT_PUBLIC_SITE_URL`, Stripe key name, `npm ci` in `Dockerfile.nuxt` | **1** |
| | **Total** | **≈ 236** |

Add ~20% integration, QA and regression buffer → **~285 hours**. Add ~40 hours to build the productisation itself (per-client config generator, setup CLI, catalogue import tooling) → **~325 hours ≈ 8 weeks full-time**.

---

## 13. Nice to have — explicitly NOT blockers

| Item | Hours |
|---|---|
| Product variants (size/colour) — schema, cart, stock, order, admin, checkout | **40** |
| Shipping zones + weight-based rates | **20** |
| Courier integration (ACS / Cyprus Post) + tracking numbers | **24** |
| Second payment provider — JCC (see §3) | **24–40** |
| Product reviews and ratings | **16** |
| CMS for homepage and static pages | **30** |
| Proper search — Postgres full-text or Meilisearch, Greek accent folding | **16** |
| Abandoned-cart recovery emails | **12** |
| Product export to CSV | **4** |
| Multi-tenant rearchitecture (§10) | **150–250** |
| Google Analytics / Meta Pixel with consent gating | **8** |
| Order status change emails to customers | **6** |
| Sitemap.xml + robots.txt + canonical tags | **6** |

---

## 14. Total to target

**Target:** a new client store live in under 8 working hours of setup, run by the owner without a developer.

| Phase | Hours |
|---|---|
| Blockers (§12) | 236 |
| Integration, QA, regression buffer (~20%) | 49 |
| Productisation — config generator, `setup.sh`, one-command provisioning, catalogue import tooling, client handover docs | 40 |
| **Total** | **≈ 325 hours ≈ 8 weeks full-time** |

Two hard dependencies sit inside that number.

**VAT and invoicing (40h) are non-negotiable** — without them the store cannot legally trade in Cyprus, so no amount of polish elsewhere makes it sellable.

**The 8-hour setup goal is unreachable while products are entered by hand** — even a flawless deployment script leaves 7–10 hours of data entry for a 100-product catalogue. The CSV importer (#12) is what makes the target arithmetically possible, not a convenience.

---

## What is genuinely good here

Worth protecting, and worth saying plainly given the length of the problem list:

- The capability-based permissions system, server-enforced, with an owner-only default and a last-owner lockout guard
- Refresh-token rotation with Redis-backed revocation
- Server-side price recalculation — the client cannot dictate totals
- Transactional order creation with atomic conditional stock decrements
- Cache invalidation on every write path
- The low-stock notification logic: de-duplicated, escalating, auto-resolving
- Clean NestJS module boundaries throughout

The foundation is sound. What is missing is everything between "a working demo" and "a business can trade on this" — and that gap is a quarter of a working year, not a sprint.
