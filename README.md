# 🛍️ Shop Starter Kit

> A reusable, single-tenant, full-stack starter system for independently deployed client websites and e-commerce applications — bilingual (Greek & English) out of the box.

![Tech Stack](https://img.shields.io/badge/Nuxt-4-00DC82?style=flat&logo=nuxt.js) ![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat&logo=nestjs) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker) ![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=flat&logo=stripe)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Production Deployment](#production-deployment)
- [External Services](#external-services)

---

## Overview

Shop Starter Kit is a reusable starter system. Today it ships a complete e-commerce implementation — bilingual content (Greek and English), Stripe payment processing, a loyalty points system, order management, and an admin panel — and it is being restructured so that the e-commerce parts become an optional module on top of a generic core.

- **It is a starting point, not a shared dependency.** Each client project is an independent clone with its own repository, database, environment, deployment, enabled modules and branding.
- **Modules are optional.** E-commerce (and future CMS, blog, booking modules) are enabled per project.
- **Core must not depend on domain modules.** Authentication, users, roles, settings, notifications and the API foundation stay generic.

---

## Architecture

Before modifying the repository, read, in order:

1. [docs/ARCHITECTURE-BLUEPRINT.md](docs/ARCHITECTURE-BLUEPRINT.md) — target architecture, layers, registries, migration phases
2. [docs/ARCHITECTURE-DECISIONS.md](docs/ARCHITECTURE-DECISIONS.md) — decisions D1–D12 and their rationale
3. [docs/DEPENDENCY-RULES.md](docs/DEPENDENCY-RULES.md) — allowed and forbidden dependencies (enforceable)
4. [docs/MODULE-DEVELOPMENT-GUIDE.md](docs/MODULE-DEVELOPMENT-GUIDE.md) — how to build a module

Every change is checked against [docs/ARCHITECTURE-CHECKLIST.md](docs/ARCHITECTURE-CHECKLIST.md). AI agents follow [AGENTS.md](AGENTS.md).

Dependency direction (downward only):

```text
PROJECT → OPTIONAL MODULES → CORE → INFRASTRUCTURE
```

The folder layout follows the blueprint's layers: `app/core/`, `app/modules/<id>/` and `app/project/` (Nuxt layers) on the frontend, `backend/src/core/`, `backend/src/modules/<id>/` and `backend/src/infrastructure/` on the backend; the blueprint maps every path to its layer.

---

## Tech Stack

### Frontend

| Technology  | Version | Purpose                      |
| ----------- | ------- | ---------------------------- |
| Nuxt        | 4.x     | SSR framework                |
| Vue 3       | 3.5     | UI framework                 |
| Pinia       | 3.x     | State management             |
| Nuxt UI     | 4.x     | Component library            |
| @nuxt/i18n  | 10.x    | Internationalization (EL/EN) |
| @nuxt/image | latest  | Image optimization           |
| Stripe.js   | latest  | Payment UI                   |

### Backend

| Technology | Version | Purpose               |
| ---------- | ------- | --------------------- |
| NestJS     | 11.x    | API framework         |
| Prisma     | 6.x     | ORM                   |
| PostgreSQL | 16      | Primary database      |
| Redis      | 7       | Caching + token store |
| Minio      | latest  | File/image storage    |
| Stripe     | latest  | Payment processing    |
| Resend     | latest  | Transactional email   |
| JWT        | —       | Authentication        |

### Infrastructure

| Technology              | Purpose                         |
| ----------------------- | ------------------------------- |
| Docker + Docker Compose | Containerization                |
| Nginx                   | Reverse proxy + SSL termination |
| Let's Encrypt           | SSL certificates                |

---

## Features

- 🛒 **Full e-commerce flow** — Browse, filter, cart, checkout, order history
- 💳 **Stripe payments** — Secure checkout with webhook order confirmation
- 🌐 **Bilingual** — Greek and English with locale-aware routing
- 👤 **Authentication** — JWT with refresh token rotation, cookie-based
- 🎁 **Loyalty points** — Earned on purchases, redeemable at checkout
- ❤️ **Favourites** — Save products, synced to account
- 📦 **Order management** — Full order history, forward-only status lifecycle, cancellation with restock and loyalty reversal, abandoned online checkouts released on Stripe expiry
- 🛡️ **Admin panel** — Product CRUD with image upload, ordering and primary image, order status management, stats
- 📧 **Transactional email** — Order confirmations, password reset via Resend
- 🖼️ **Image storage** — Self-hosted Minio with pre-signed URLs
- 📱 **Responsive** — Mobile-first design
- 🔒 **Security** — HTTPS, HSTS, security headers, rate limiting (Nginx + throttler), input validation

---

## Project Structure

```
shop-starter-kit/
├── app/                          # Nuxt 4 frontend
│   ├── components/               # Vue components
│   │   ├── cart/                 # CartDrawer, CartItem
│   │   ├── checkout/             # CheckoutSteps
│   │   ├── layout/               # AppHeader, AppFooter
│   │   └── product/              # ProductCard, ProductGrid
│   ├── composables/              # useApi, useProducts, useCurrency
│   ├── layouts/                  # default.vue, admin.vue
│   ├── middleware/               # auth.ts, guest.ts, admin.ts
│   ├── pages/                    # File-based routing
│   │   ├── account/              # Profile, orders, favourites
│   │   ├── admin/                # Admin panel
│   │   ├── checkout/             # Checkout flow
│   │   └── products/             # Product listing + detail
│   ├── plugins/                  # auth.client, auth.server, stripe
│   ├── stores/                   # Pinia stores (auth, cart, favourites, filters)
│   └── types/                    # TypeScript types
│
├── backend/                      # NestJS API
│   ├── prisma/                   # Schema + migrations
│   └── src/
│       ├── admin/                # Admin endpoints (stats, orders, products, categories, customers, newsletter, settings)
│       ├── analytics/            # Admin analytics
│       ├── auth/                 # JWT auth, guards, strategies, capabilities
│       ├── categories/           # Product categories
│       ├── common/               # Shared filters, interceptors, utils
│       ├── favourites/           # User favourites
│       ├── health/               # Health check
│       ├── mail/                 # Email service (Resend / SMTP)
│       ├── minio/                # File storage
│       ├── newsletter/           # Newsletter subscribe/unsubscribe
│       ├── notifications/        # Admin notifications (low stock)
│       ├── orders/               # Order creation + history
│       ├── payments/             # Stripe integration + webhooks
│       ├── products/             # Product listing + detail
│       ├── profile/              # User profile management
│       ├── redis/                # Redis caching
│       ├── settings/             # Pricing settings
│       ├── staff/                # Staff accounts + roles
│       ├── uploads/              # File upload endpoint
│       └── users/                # User repository
│
├── docker/
│   └── nginx/
│       ├── nginx.conf            # Nginx configuration
│       └── ssl/                  # SSL certificates (not committed)
│
├── i18n/
│   ├── el.json                   # Greek translations
│   └── en.json                   # English translations
│
├── docs/                         # Architecture blueprint, decisions, rules, guides (tracked)
├── AGENTS.md                     # Authoritative instructions for AI agents
├── docker-compose.yml            # Local development (full Docker)
├── docker-compose.prod.yml       # Production
├── Dockerfile.nuxt               # Frontend container
└── .env.example                  # Environment variable template
```

---

## Prerequisites

### Local Development

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose v2

### Production Server

- Ubuntu 22.04 or 24.04 LTS
- Docker 24+ and Docker Compose v2
- Minimum 2GB RAM (4GB recommended)
- Minimum 20GB disk space
- Ports 80 and 443 open
- A domain name (for SSL)

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/your-org/shop-starter-kit.git
cd shop-starter-kit
```

### Customize for a new project

The files a new project edits today. This is not a complete cloning guide, and not every project-specific value is centralized yet — see *Known current limitations* below.

**Project configuration** — `app/project/project.config.ts`:

- `BUSINESS` — name, legal name and tagline; brand assets (`brand.logo`, `brand.favicon`, `brand.appleTouchIcon`, `brand.ogImage`); contact details (`phone`, `phoneDisplay`, `whatsapp`), `address`, `geo`, `timezone` and opening hours (`displayHours`, `schemaHours`); the structured-data values `schemaType` and `priceRange`.
- `REGION` — `currency`: the storefront formats prices with it and the backend checkout charges in it.
- `LOCALES` — the languages served and the default one.

**Branding**

- `app/project/assets/css/brand.css` — the palette. `--brand-primary` is the storefront accent and the email colour (a literal hex).
- `app/project/public/` — `favicon.svg`, `apple-touch-icon.png`, `og-image.png` and the placeholder images in `images/`.

**Project pages and copy**

- `app/project/pages/` — `index.vue`, `about.vue`, `contact.vue`.
- `app/project/i18n/el.json`, `app/project/i18n/en.json` — the project's own texts.
- `app/project/components/` — the brand lockup and wordmark, and the WhatsApp button.

**Modules** — `modules.json` lists the application modules and whether each is enabled. The frontend reads it directly; the backend reads the generated `backend/src/modules.enabled.ts`, so after changing it run:

```bash
cd backend && npm run modules:generate
```

**Backend project identity** — the backend cannot read `app/project/`, so the values it uses (`BUSINESS.name`, `BUSINESS.brand.logo`, `REGION.currency`, `--brand-primary`) are generated into `backend/src/project.identity.ts`. That file is committed and is what the backend build and its Docker image use, so after changing `project.config.ts` or `brand.css` regenerate and check it, then commit the result:

```bash
cd backend
npm run project:generate
npm run verify:project
```

**Verify** — needs installed dependencies and a generated Prisma Client (`cd backend && npm run db:generate`; see *Option B → Step 2* below). The backend gate includes both generated-file checks; the frontend gates run from the repository root:

```bash
cd backend && npm run verify
```

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

**Known current limitations**

- Languages: only `el` and `en` are supported today — product and category data carry `name_el` / `name_en`, and every layer ships `el.json` / `en.json`, so adding or replacing a language needs code and data changes.
- Brand colour: some copies of the default accent (`#c97b5a`) are still hard-coded — in `app/assets/css/admin.css`, a few Ecommerce admin pages and components, the admin charts and the Ecommerce product placeholder image — so changing `--brand-primary` does not recolour those yet.
- Currency: the admin settings show `€` as the unit of the shipping amounts, several Ecommerce and project texts contain `€`, and the checkout converts amounts to minor units by ×100, so only two-decimal currencies are handled correctly.
- Docker: container names (`shopkit_*`) and host ports are fixed in `docker-compose.yml` and `docker-compose.prod.yml`, so two stacks cannot run side by side on one machine.

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values. For local development the defaults work for most fields — you only need real values for Stripe and Resend.

### 3. Create the Minio bucket

Before starting the app, Minio needs a bucket. Start Minio and create it:

```bash
docker compose up -d minio
```

Then open `http://localhost:9001`, log in with your `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` from `.env`, and create a bucket matching your `MINIO_BUCKET` value (default: `shopkit-images`).

---

### Option A — Full Docker (easiest, everything containerized)

Runs the entire stack including frontend and backend inside Docker.

```bash
docker compose up -d
```

| Service       | URL                   |
| ------------- | --------------------- |
| Frontend      | http://localhost:3000 |
| Backend API   | http://localhost:3001 |
| Minio Console | http://localhost:9001 |

**Note:** This builds Docker images which takes a few minutes the first time. Use this option to test the production build locally.

> ⚠️ **After changing backend code, Dockerfile, or `start.sh`, you must rebuild** — `docker compose up` alone reuses the stale image and your changes won't apply:
> ```bash
> docker compose up -d --build            # rebuild all
> docker compose up -d --build backend    # rebuild only backend
> ```

---

### Option B — Infrastructure in Docker, code runs locally (recommended for development)

Runs only PostgreSQL, Redis, and Minio in Docker. Runs Nuxt and NestJS natively for hot reload and faster development.

**Step 1 — Start infrastructure:**

```bash
docker compose up -d postgres redis minio
```

**Step 2 — Install dependencies:**

```bash
# Root (Nuxt)
pnpm install

# Backend
cd backend && npm install && cd ..

# Backend — generate the Prisma Client
cd backend && npm run db:generate && cd ..
```

`npm run db:generate` generates the Prisma Client from `backend/prisma/`; `npm install` does not. Run it after installing backend dependencies and after any schema change. It does not need a running database.

**Step 3 — Run database migrations:**

```bash
cd backend
npx prisma migrate dev
cd ..
```

**Step 4 — Start the dev servers (two terminals):**

Terminal 1 — Frontend:

```bash
pnpm dev
```

Terminal 2 — Backend:

```bash
cd backend
npm run start:dev
```

| Service       | URL                   |
| ------------- | --------------------- |
| Frontend      | http://localhost:3000 |
| Backend API   | http://localhost:3001 |
| Minio Console | http://localhost:9001 |

### Verification (what CI runs)

Both halves have a gate; run them before pushing. The backend gate needs a generated Prisma Client: CI's backend job runs `npx prisma generate` after `npm ci`; locally, `cd backend && npm run db:generate` is the same step.

```bash
# backend — typecheck → build → architecture boundaries → route inventory → provider matrix
cd backend && npm run verify

# frontend — lint → typecheck → unit tests → build (no secrets needed)
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

`GET /health` reports PostgreSQL and Redis (`503` when either is down) and backs the backend container's healthcheck.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values.

| Variable                      | Description                             | Required |
| ----------------------------- | --------------------------------------- | -------- |
| `DB_USER`                     | PostgreSQL username                     | ✅       |
| `DB_PASSWORD`                 | PostgreSQL password                     | ✅       |
| `DB_NAME`                     | PostgreSQL database name                | ✅       |
| `DATABASE_URL`                | Full PostgreSQL connection string       | ✅       |
| `REDIS_PASSWORD`              | Redis password                          | ✅       |
| `REDIS_URL`                   | Full Redis connection string            | ✅       |
| `JWT_SECRET`                  | JWT access token secret (min 32 chars)  | ✅       |
| `JWT_REFRESH_SECRET`          | JWT refresh token secret (min 32 chars) | ✅       |
| `JWT_ACCESS_EXPIRES`          | Access token TTL (e.g. `15m`)           | ✅       |
| `JWT_REFRESH_EXPIRES`         | Refresh token TTL (e.g. `7d`)           | ✅       |
| `MINIO_ROOT_USER`             | Minio admin username                    | ✅       |
| `MINIO_ROOT_PASSWORD`         | Minio admin password                    | ✅       |
| `MINIO_BUCKET`                | Minio bucket name for images            | ✅       |
| `MINIO_PUBLIC_URL`            | Public URL for Minio                    | ✅       |
| `STRIPE_SECRET_KEY`           | Stripe secret key                       | ✅       |
| `STRIPE_WEBHOOK_SECRET`       | Stripe webhook signing secret           | ✅       |
| `RESEND_API_KEY`              | Resend email API key                    | ✅       |
| `EMAIL_FROM`                  | Sender email address                    | ✅       |
| `NUXT_PUBLIC_API_BASE`        | Backend API URL (public)                | ✅       |
| `NUXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp contact number                 | ✅       |
| `NUXT_URL`                    | Frontend URL(s) for CORS (prod only)    | ✅       |

### CORS behavior

- **Development** (`NODE_ENV=development`): backend allows **any** `http://localhost:<port>` origin. `NUXT_URL` is ignored. This avoids breakage when Nuxt picks an alternate port (e.g. 3002 if 3000 is taken).
- **Production** (`NODE_ENV=production`): backend allows **only** the origins in `NUXT_URL`. Supports multiple, comma-separated:
  ```
  NUXT_URL=https://example.com,http://localhost:3000
  ```
  Accessing via Nginx (port 80/443) is same-origin, so no CORS applies there.

---

## Production Deployment

There is no standalone deployment guide yet. Production runs from [docker-compose.prod.yml](docker-compose.prod.yml) behind the Nginx config in [docker/nginx/nginx.conf](docker/nginx/nginx.conf):

```bash
cp .env.example .env            # fill in real values; set OWNER_EMAIL / OWNER_PASSWORD for first boot
docker compose -f docker-compose.prod.yml up -d --build
```

Place `fullchain.pem` and `privkey.pem` in `docker/nginx/ssl/` (never committed). Set `MINIO_PUBLIC_URL=https://<domain>/media` and `NUXT_URL=https://<domain>`. After the first boot, remove `OWNER_PASSWORD` from `.env` (see [PETSHOPCY-MANUAL.md](PETSHOPCY-MANUAL.md) §4).

Downstream client projects that pull changes from this repository follow [PETSHOPCY-MANUAL.md](PETSHOPCY-MANUAL.md) for the steps that cannot propagate by cherry-pick.

---

## External Services

### Stripe

1. Create an account at [stripe.com](https://stripe.com)
2. Get your API keys from the Stripe Dashboard
3. Set up a webhook endpoint pointing to `https://yourdomain.com/api/payments/webhook`
4. Add the webhook secret to your `.env`

**Required webhook events:**

- `checkout.session.completed` — settles the order
- `checkout.session.expired` — releases the stock of an abandoned checkout (the order is cancelled)
- `payment_intent.payment_failed`

### Resend (Email)

1. Create an account at [resend.com](https://resend.com)
2. Verify your sending domain in the Resend dashboard
3. Generate an API key and add to your `.env`
4. Update `EMAIL_FROM` to use your verified domain

### Minio (File Storage)

Minio is self-hosted and runs as a Docker container. No external account needed. In production, images are served via pre-signed URLs generated by the backend.

---

## Admin Access

The recommended way to create the first admin (owner) is the env-driven bootstrap: set `OWNER_EMAIL` and `OWNER_PASSWORD` (12+ characters) in `.env` before the first boot. The seed creates the owner once and never again. Remove `OWNER_PASSWORD` afterwards.

Alternatively, register through the app first, then promote the account:

```bash
# Local
docker compose exec postgres psql -U shopkit -d shopkit -c \
  "UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';"

# Production
docker compose -f docker-compose.prod.yml exec postgres psql -U shopkit -d shopkit -c \
  "UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';"
```

---

## License

Private — all rights reserved.
