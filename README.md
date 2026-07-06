# 🛍️ Shop Starter Kit

> A full-stack, reusable e-commerce starter kit with bilingual support (Greek & English).

![Tech Stack](https://img.shields.io/badge/Nuxt-3-00DC82?style=flat&logo=nuxt.js) ![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat&logo=nestjs) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker) ![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=flat&logo=stripe)

---

## Table of Contents

- [Overview](#overview)
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

Shop Starter Kit is a production-ready, reusable e-commerce starter kit. It supports bilingual content (Greek and English), Stripe payment processing, a loyalty points system, order management, and an admin panel for product and order management.

---

## Tech Stack

### Frontend

| Technology  | Version | Purpose                      |
| ----------- | ------- | ---------------------------- |
| Nuxt 3      | 4.x     | SSR framework                |
| Vue 3       | 3.5     | UI framework                 |
| Pinia       | 2.x     | State management             |
| Nuxt UI     | 4.x     | Component library            |
| @nuxt/i18n  | 10.x    | Internationalization (EL/EN) |
| @nuxt/image | latest  | Image optimization           |
| Stripe.js   | latest  | Payment UI                   |

### Backend

| Technology | Version | Purpose               |
| ---------- | ------- | --------------------- |
| NestJS     | 10.x    | API framework         |
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
- 📦 **Order management** — Full order history with status tracking
- 🛡️ **Admin panel** — Product CRUD, order status management, stats
- 📧 **Transactional email** — Order confirmations, password reset via Resend
- 🖼️ **Image storage** — Self-hosted Minio with pre-signed URLs
- 📱 **Responsive** — Mobile-first design
- 🔒 **Security** — HTTPS, HSTS, CSP, rate limiting, input validation

---

## Project Structure

```
shop-starter-kit/
├── app/                          # Nuxt 3 frontend
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
│       ├── auth/                 # JWT auth, guards, strategies
│       ├── admin/                # Admin endpoints
│       ├── categories/           # Product categories
│       ├── common/               # Shared filters, interceptors, utils
│       ├── favourites/           # User favourites
│       ├── mail/                 # Email service (Resend)
│       ├── minio/                # File storage
│       ├── newsletter/           # Newsletter subscribe/unsubscribe
│       ├── orders/               # Order creation + history
│       ├── payments/             # Stripe integration + webhooks
│       ├── products/             # Product listing + detail
│       ├── profile/              # User profile management
│       ├── redis/                # Redis caching
│       └── uploads/              # File upload endpoint
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

Then open `http://localhost:9001`, log in with your `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` from `.env`, and create a bucket matching your `MINIO_BUCKET` value (default: `petshop-images`).

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
```

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
| `STRIPE_PUBLISHABLE_KEY`      | Stripe publishable key                  | ✅       |
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

See [DEPLOY.md](./DEPLOY.md) for the complete step-by-step production deployment guide.

---

## External Services

### Stripe

1. Create an account at [stripe.com](https://stripe.com)
2. Get your API keys from the Stripe Dashboard
3. Set up a webhook endpoint pointing to `https://yourdomain.com/api/payments/webhook`
4. Add the webhook secret to your `.env`

**Required webhook events:**

- `checkout.session.completed`
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

To create an admin user, register through the app first, then run:

```bash
# Local
docker compose exec postgres psql -U petshop -d petshop -c \
  "UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';"

# Production
docker compose -f docker-compose.prod.yml exec postgres psql -U petshop -d petshop -c \
  "UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';"
```

---

## License

Private — all rights reserved.
