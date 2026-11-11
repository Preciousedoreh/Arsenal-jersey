# Jersey Store API

Backend for an online store selling **jerseys** and **merchandise**. Node.js + TypeScript (strict), Express 5, PostgreSQL/Prisma, Better Auth, BullMQ/Redis, Zod.

- Email + password auth with email verification, password reset, session cookies, rate limiting, and account lockout
- Product catalogue and admin inventory management with a full stock audit log
- Orders that **deduct stock atomically and never oversell**, with automatic restock on cancellation
- Queued, templated email notifications
- OpenAPI docs at `/api/docs`

---

## Quick start

Prerequisites: **Node.js 22+** and **Docker**.

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then set BETTER_AUTH_SECRET (see below)
docker compose up -d        # Postgres (host port 5433), Redis (6379), Mailpit (1025 / UI 8025)
npm run db:migrate          # apply migrations
npm run db:seed             # admin user + sample jerseys & merch
npm run dev                 # http://localhost:4000  (docs: http://localhost:4000/api/docs)
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Every email sent in development is visible in **Mailpit at http://localhost:8025**.

Sign in as the seeded admin with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`.

> Postgres is mapped to host port **5433** so it doesn't clash with a locally installed PostgreSQL on 5432.

### Scripts

| Script                                                       | What it does                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `npm run dev`                                                | API with hot reload (runs the email worker in-process)            |
| `npm run dev:worker`                                         | Standalone email worker (use with `RUN_WORKERS_IN_PROCESS=false`) |
| `npm run build` / `npm start`                                | Compile to `dist/` and run the compiled API                       |
| `npm run start:worker`                                       | Run the compiled worker                                           |
| `npm test`                                                   | Full test suite (needs `docker compose up -d`)                    |
| `npm run typecheck` / `npm run lint` / `npm run format`      | Quality checks                                                    |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma                                                            |

---

## Testing

```bash
docker compose up -d
npm test
```

Tests use a separate database, `jersey_store_test`, which the Postgres container creates on first start. Settings come from `.env.test`. Migrations are applied automatically, and each test starts from truncated tables. The test helpers refuse to run against any database whose name doesn't end in `_test`. Emails go to an in-memory outbox, and jobs run inline, so tests don't need Mailpit.

What's covered (51 tests):

- **Auth:** register → verification email → unverified users can't order → verify → login; role can't be self-assigned; password policy; reset (generic response, single-use token, sessions revoked); change password; logout of all devices; session token never in JSON responses
- **Rate limiting / lockout:** 6th login attempt for the same IP + email → `429` with `Retry-After`; distributed failures → account locked plus an email to the owner
- **Authorization:** `401` for anonymous users, `403` for customers on admin routes; CSRF origin rejection; admins can't change their own role
- **Products:** CRUD, validation, duplicate SKU `409`, public visibility, pagination and filters, hard vs soft delete
- **Inventory:** add/set stock with audit log (who, when, why), never below 0, low-stock email, dashboard
- **Orders:** stock deduction with price snapshot and movement log; insufficient stock rolls back the whole order; **40 concurrent orders for 10 units → exactly 10 succeed and stock ends at 0**; mixed-quantity race; low-stock email sent once per threshold crossing
- **Cancellation:** stock restored once, even when several cancellations race; customer vs admin rules; shipped orders can't be cancelled
- **Status workflow and payments:** valid transitions, timestamps, customer emails; signed mock webhook marks orders `PAID` idempotently and rejects bad signatures or wrong amounts

---

## Environment variables

All variables are validated with Zod at startup ([src/config/env.ts](src/config/env.ts)). The process refuses to start if any are missing or invalid. Production also forbids the in-memory email transport, the inline queue, and non-https URLs.

| Variable                                                              | Default                  | Purpose                                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                            | `development`            | `development` \| `test` \| `production`                                                                                                   |
| `PORT`                                                                | `4000`                   | HTTP port                                                                                                                                 |
| `LOG_LEVEL`                                                           | `info`                   | pino level                                                                                                                                |
| `TRUST_PROXY`                                                         | `false`                  | Express `trust proxy` (`true`, hop count, or subnets). Set this correctly behind a load balancer or rate limiting will see the proxy's IP |
| `STORE_NAME`                                                          | `Jersey Store`           | Used in emails and docs                                                                                                                   |
| `STORE_CURRENCY`                                                      | `USD`                    | Default ISO-4217 currency for new products                                                                                                |
| `BETTER_AUTH_URL`                                                     | —                        | Public base URL of this API (email links point here)                                                                                      |
| `FRONTEND_URL`                                                        | —                        | Frontend origin (trusted for redirects and CORS)                                                                                          |
| `CORS_ORIGINS`                                                        | —                        | Comma-separated browser origins allowed to call the API with cookies                                                                      |
| `DATABASE_URL`                                                        | —                        | PostgreSQL connection string                                                                                                              |
| `REDIS_URL`                                                           | `redis://localhost:6379` | BullMQ queue and Redis rate-limit store                                                                                                   |
| `BETTER_AUTH_SECRET`                                                  | —                        | At least 32 random characters; signs sessions and tokens                                                                                  |
| `PASSWORD_BREACH_CHECK`                                               | `true`                   | Reject passwords found in the Have I Been Pwned corpus (free k-anonymity API; only a 5-character hash prefix leaves the server)           |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`                       | —                        | First admin, created by `npm run db:seed` (password at least 12 characters)                                                               |
| `RATE_LIMIT_STORE`                                                    | `memory`                 | `memory` (single instance) or `redis` (use in production / multi-instance)                                                                |
| `RATE_LIMIT_API_WINDOW_MS` / `RATE_LIMIT_API_MAX`                     | `60000` / `100`          | General API limit per IP                                                                                                                  |
| `AUTH_RATE_LIMIT_ENABLED`                                             | `true`                   | Better Auth's per-IP limits on auth routes                                                                                                |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_SECONDS`                         | `5` / `900`              | Sign-in attempts per IP + email                                                                                                           |
| `LOCKOUT_THRESHOLD` / `LOCKOUT_DURATION_MINUTES`                      | `10` / `30`              | Consecutive failures (any IP) before the account locks                                                                                    |
| `EMAIL_TRANSPORT`                                                     | `smtp`                   | `smtp` or `memory` (tests only)                                                                                                           |
| `EMAIL_FROM`                                                          | —                        | From header                                                                                                                               |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Mailpit                  | SMTP settings                                                                                                                             |
| `QUEUE_DRIVER`                                                        | `bullmq`                 | `bullmq` or `inline` (tests only)                                                                                                         |
| `RUN_WORKERS_IN_PROCESS`                                              | `true`                   | Run the email worker inside the API process                                                                                               |
| `PAYMENT_PROVIDER`                                                    | `mock`                   | Only `mock` is implemented so far                                                                                                         |
| `PAYMENT_WEBHOOK_SECRET`                                              | —                        | HMAC secret for the mock provider's webhook signatures                                                                                    |
| `API_DOCS_ENABLED`                                                    | `true`                   | Serve Swagger UI at `/api/docs`                                                                                                           |

---

## API overview

Full interactive docs: **`/api/docs`**. Raw spec: **`/api/docs/openapi.json`**.

**Conventions**

- Money is always an **integer in minor units** (`priceCents: 8999` = $89.99).
- Single resources return `{ data }`. Lists return `{ data: [...], pagination: { page, pageSize, total, totalPages } }` and accept `?page=&pageSize=` (max 100).
- Errors: `{ error: { code, message, details? } }`, e.g. `409 { error: { code: "INSUFFICIENT_STOCK", details: { productId, productName, requested, available } } }`.
  The exception is Better Auth routes under `/api/auth/*`, which use Better Auth's own `{ code, message }` shape. Its official client expects that shape.
- Every `429` includes `Retry-After` (seconds).
- Responses include an `X-Request-Id` header, which also appears in the logs.

**Auth** (Better Auth, mounted at `/api/auth/*`)

| Method      | Path                                                | Notes                                                                                                             |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| POST        | `/api/auth/sign-up/email`                           | `{ name, email, password, callbackURL? }`. Creates a CUSTOMER account and sends a verification email              |
| POST        | `/api/auth/sign-in/email`                           | `{ email, password }`. Sets the session cookie                                                                    |
| POST        | `/api/auth/sign-out`                                |                                                                                                                   |
| GET         | `/api/auth/verify-email?token=`                     | Target of the verification link                                                                                   |
| POST        | `/api/auth/send-verification-email`                 | Resend verification                                                                                               |
| POST        | `/api/auth/request-password-reset`                  | `{ email, redirectTo? }`. Always returns the same response (this is Better Auth 1.7's name for "forget-password") |
| POST        | `/api/auth/reset-password`                          | `{ token, newPassword }`. Single-use token; revokes all sessions                                                  |
| POST        | `/api/auth/change-password`                         | `{ currentPassword, newPassword, revokeOtherSessions? }`                                                          |
| GET         | `/api/auth/get-session` / `/api/auth/list-sessions` |                                                                                                                   |
| POST        | `/api/auth/revoke-sessions`                         | Log out of all devices                                                                                            |
| GET / PATCH | `/api/me`                                           | Current user + role / update name and avatar                                                                      |

**Catalogue:** `GET /api/products?category=JERSEY|MERCHANDISE&search=&page=`, `GET /api/products/:slug`

**Orders** (signed in; placing and paying require a verified email)

| Method | Path                              | Notes                                                            |
| ------ | --------------------------------- | ---------------------------------------------------------------- |
| POST   | `/api/orders`                     | `{ items: [{ productId, quantity }], shippingAddress? }`         |
| GET    | `/api/orders`, `/api/orders/:id`  | Your own orders only (others' orders return `404`)               |
| POST   | `/api/orders/:id/cancel`          | Only while `PENDING`; restores stock                             |
| POST   | `/api/orders/:id/pay`             | Starts a payment; returns `{ provider, reference, checkoutUrl }` |
| POST   | `/api/payments/webhook/:provider` | Provider callback; marks the order `PAID`                        |

**Admin** (`ADMIN` role)

| Method               | Path                                         | Notes                                                                                   |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| GET / POST           | `/api/admin/products`                        | List all (`?status=active\|inactive\|deleted\|all`) / create                            |
| GET / PATCH / DELETE | `/api/admin/products/:id`                    | DELETE soft-deletes products that have orders and hard-deletes the rest                 |
| POST                 | `/api/admin/products/:id/stock`              | `{ change: 50 }` or `{ set: 120 }`, plus optional `reason: RESTOCK\|ADJUSTMENT`, `note` |
| GET                  | `/api/admin/inventory`                       | Stock per product, low-stock flags, units sold, summary (`?lowStockOnly=true`)          |
| GET                  | `/api/admin/inventory/movements`             | Audit log (`?productId=&reason=`)                                                       |
| GET                  | `/api/admin/orders`, `/api/admin/orders/:id` | Filter by `status`, `from`, `to`, `userId`                                              |
| PATCH                | `/api/admin/orders/:id/status`               | `{ status, note? }`                                                                     |
| GET                  | `/api/admin/users`                           | Filter by `role` and `search`                                                           |
| PATCH                | `/api/admin/users/:id/role`                  | `{ role }`. Admins can't change their own role                                          |

**Health:** `GET /api/health` returns database and Redis status (`503` when degraded).

**Order lifecycle:** `PENDING → PAID → PROCESSING → SHIPPED → DELIVERED`. `CANCELLED` is allowed from `PENDING` (customer or admin) and from `PAID` / `PROCESSING` (admin only). Cancelling restores stock. Cancelling a paid order also calls `PaymentService.refund`.

---

## How the critical parts work

### No overselling

[orders.service.ts](src/modules/orders/orders.service.ts) places an order in **one** transaction:

1. Load the products and check each is active and that all share one currency.
2. For each line, sorted by product id so concurrent orders lock rows in the same order (no deadlocks), run a conditional atomic update:
   `UPDATE products SET stockQuantity = stockQuantity - :qty WHERE id = :id AND stockQuantity >= :qty AND isActive`.
   Postgres re-evaluates the `WHERE` after waiting on a concurrent writer's row lock. A line that can't be filled updates 0 rows, which throws `409 INSUFFICIENT_STOCK` and rolls back the whole transaction.
3. Create the `Order` and `OrderItem`s with a **name/SKU/price snapshot**.
4. Write `InventoryMovement` rows (`reason: ORDER`, `stockAfter`).

A database `CHECK (stockQuantity >= 0)` constraint backs this up. Emails are queued only **after** commit.

Cancellation uses a conditional status update (`WHERE status IN (...)`), so stock is restored exactly once even when two cancellations race.

### Auth hardening

- Better Auth with scrypt password hashing, minimum 8 characters, and an optional HIBP breach check.
- Session cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production. The raw session token is stripped from sign-in, sign-up and get-session JSON responses.
- **CSRF:** Better Auth checks `Origin` on its own routes. [security.ts](src/middleware/security.ts) applies the same check to every other cookie-authenticated state-changing request (OWASP "verify origin with standard headers").
- **Rate limits:**
  - Better Auth per-IP limits: sign-in 20/15 min; sign-up, reset and resend-verification 5/hour.
  - Per **IP + email**: 5 sign-ins per 15 min.
  - General API: 100 requests per minute.
  - Production limits are stored in Redis.
- **Lockout:** 10 consecutive failures from any IP lock the account for 30 minutes and email the owner. Failures are tracked by email, so the behaviour is identical for unknown emails and doesn't reveal which accounts exist.
- The client IP reaches Better Auth through a header that Express sets from `req.ip` and overwrites on every request, so clients can't spoof it.
- `helmet`, a CORS allow-list, `hpp`, 100 kb body limits, and pino redaction of cookies, passwords and tokens. Unexpected errors return a generic `500` with no stack trace.

### Email

Business code calls [`notifications`](src/services/notifications.ts), which **enqueues** a typed job and never throws into the request. The BullMQ worker ([email.worker.ts](src/jobs/email.worker.ts)) renders the Handlebars templates (HTML + plain text, in [templates/index.ts](src/services/email/templates/index.ts)) and sends through the `EmailService` interface, retrying 5 times with exponential backoff.

To switch to Resend or SendGrid, implement `EmailService` in [email.service.ts](src/services/email/email.service.ts). Nothing else changes.

### Payments

[payment.service.ts](src/services/payment/payment.service.ts) defines the `PaymentService` interface (`initiate`, `verifyWebhook`, `refund`) and ships a mock provider. To add Stripe or Paystack:

1. Implement the interface: create the checkout or transaction, and verify the provider's signature header against the raw body.
2. Register the provider in `PAYMENT_PROVIDER`.

The webhook route already receives the raw body. Each `/pay` call creates a `Payment` row (its own reference, amount and currency), so a webhook for any attempt resolves to the right order. Each payment is applied once (replays are no-ops), the amount and currency are checked, and money that cannot be applied (order cancelled, or already paid by another attempt) is refunded automatically. Both providers are paid services, so they are not wired in yet.

To try the mock webhook locally:

```bash
BODY='{"type":"payment.succeeded","reference":"<reference from /pay>","amountCents":8999,"currency":"USD"}'
SIG=$(node -e "console.log(require('crypto').createHmac('sha256', process.argv[1]).update(process.argv[2]).digest('hex'))" "$PAYMENT_WEBHOOK_SECRET" "$BODY")
curl -X POST localhost:4000/api/payments/webhook/mock -H "Content-Type: application/json" -H "x-mock-signature: $SIG" -d "$BODY"
```

---

## Project structure

```
src/
  config/        env.ts (zod-validated env), logger.ts (pino)
  lib/           prisma.ts, auth.ts (Better Auth), loginGuard.ts, rateLimitCounter.ts, redis.ts, queue.ts
  middleware/    auth.ts (requireAuth/requireVerified/requireRole), validate.ts, rateLimit.ts, security.ts, error.ts
  modules/
    products/    *.routes.ts → *.controller.ts → *.service.ts → *.repository.ts, *.schemas.ts
    inventory/   stock adjustments, dashboard, audit log
    orders/      transactional ordering, cancellation, status workflow
    users/       /me and admin user management
    payments/    webhook controller
  services/      email/ (interface, nodemailer impl, templates), payment/ (interface + mock), notifications.ts
  jobs/          email.worker.ts, lowStock.ts
  docs/          OpenAPI generation + Swagger UI
  contracts.ts   every zod schema + response type, for the frontend
  app.ts         Express app (no listen); server.ts (listen + graceful shutdown); worker.ts
prisma/          schema.prisma, migrations/, seed.ts
tests/           Vitest + Supertest integration tests
```

## For the frontend

- Import request schemas and response types from [src/contracts.ts](src/contracts.ts). They depend only on `zod`.
- Use the Better Auth client (`better-auth/react` or `better-auth/client`) with `baseURL` set to this API and `credentials: 'include'`.
- Add the frontend's origin to `CORS_ORIGINS` and `FRONTEND_URL`.
- Send `callbackURL` / `redirectTo` pointing at frontend routes. Those routes must be on an allow-listed origin.

## Production notes

- Set `NODE_ENV=production`, `RATE_LIMIT_STORE=redis`, `TRUST_PROXY` to match your proxy, `BETTER_AUTH_URL` to an https URL, and real SMTP credentials.
- Run `npm run db:deploy` (not `db:migrate`) during deploys.
- To scale email independently, run the worker separately: `RUN_WORKERS_IN_PROCESS=false` on the API, plus `npm run start:worker`.
- `SIGTERM` drains HTTP connections, the worker, the queue, Prisma and Redis before exiting.
