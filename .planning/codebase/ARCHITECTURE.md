<!-- refreshed: 2026-06-04 -->
# Architecture

**Analysis Date:** 2026-06-04

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                   packages/dashboard (Astro static + React)         │
│           `packages/dashboard/src/pages/**.astro`                    │
│           `packages/dashboard/src/components/*.tsx`                  │
├──────────────────────┬──────────────────────────────────────────────┤
│   AuthLayout         │           DashboardLayout                     │
│   `auth-layout.astro`|           `dashboard-layout.astro`            │
│   /login page        │           /dashboard/{usage,billing,          │
│                      │            api-keys,profile,admin/*}          │
├──────────────────────┴──────────────────────────────────────────────┤
│              api-client.ts  (typed fetch wrapper, cookie JWT)        │
│              `packages/dashboard/src/lib/api-client.ts`              │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ /api/* (Bearer JWT cookie)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              packages/api (Hono on Cloudflare Workers)               │
│                     `packages/api/src/index.ts`                      │
├──────────┬──────────────┬───────────────┬──────────────┬─────────────┤
│  /v1     │ /api/auth    │ /api/admin    │ /api/profile │ /api/webhooks│
│ OpenAI + │ OTP send/    │ users,        │ /api/keys    │ /api/billing│
│ Anthropic│ verify       │ transactions, │ /api/usage   │ /sepay      │
│ compat   │              │ reindex       │ /api/billing │             │
├──────────┴──────────────┴───────┬───────┴──────────────┴─────────────┤
│            Middleware            │         Route Handlers             │
│  api-key-middleware (SHA-256)    │  (auth-routes, openai-routes,     │
│  auth-middleware (JWT)           │   admin-routes, billing-routes…)  │
│  rate-limit-middleware           │                                   │
│  admin-middleware                │                                   │
└──────────────────────────────────┴───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Services (factory functions)                  │
│  billing | rag | gateway | jwt | otp | email | indexer | usage     │
│  embedding | vectorize | r2-storage | context-builder | sepay       │
│  token-counter | proof-upload                                       │
└──────────────────────────────────┬───────────────────────────────────┘
                                  │
        ┌──────────┬──────────┬───┴─────┬──────────────┬────────────┐
        ▼          ▼          ▼         ▼              ▼            ▼
     ┌──────┐  ┌────────┐ ┌────────┐ ┌─────────┐  ┌──────────┐ ┌──────────┐
     │  D1  │  │   R2   │ │Vectori-│ │Workers  │  │   AI     │ │Emailit   │
     │      │  │ Bucket │ │  ze    │ │   AI    │  │ Gateway  │ │ + SePay  │
     │users │  │ RAG    │ │ RAG    │ │ embed / │  │ upstream │ │ webhook  │
     │keys  │  │ docs + │ │ index  │ │ infer.  │  │ caching  │ │  (VND    │
     │usage │  │ proofs │ │        │ │         │  │ rate-lim │ │  QR)     │
     │topup │  │        │ │        │ │         │  │          │ │          │
     └──────┘  └────────┘ └────────┘ └─────────┘  └──────────┘ └──────────┘
```

The system is a single Cloudflare Worker that hosts both an AI-gateway REST API
(`/v1/chat/completions`, `/v1/messages`) and a customer dashboard (Astro static
build served as Worker assets). Authentication, billing, RAG, and admin
endpoints all run in the same Worker. The dashboard is browser-side
JavaScript that calls the Worker's `/api/*` JSON endpoints with a JWT stored
in an HttpOnly-ish cookie.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `index.ts` (API) | Mount all route groups on Hono app, register CORS + logger, fallback to static assets | `packages/api/src/index.ts` |
| `index.ts` (Worker entry) | Hono `Bindings` type with D1/R2/AI/Vectorize/AI-Gateway + secrets | `packages/api/src/index.ts` |
| `wrangler.toml` | Cloudflare resource bindings (D1 id, R2 bucket, Vectorize index, AI Gateway id) | `packages/api/wrangler.toml` |
| Route groups | HTTP boundary; bind middleware + delegate to services; handle streaming pass-through | `packages/api/src/routes/*-routes.ts` |
| `auth-middleware` | Verify JWT Bearer, attach `c.get("user")`, reject inactive users | `packages/api/src/middleware/auth-middleware.ts` |
| `api-key-middleware` | Verify `Bearer sk-…`, SHA-256 hash lookup in D1, attach `userId`/`apiKeyId`, set `last_used_at` | `packages/api/src/middleware/api-key-middleware.ts` |
| `rate-limit-middleware` | In-memory sliding-window counter (60 req/min) keyed by `apiKeyId` | `packages/api/src/middleware/rate-limit-middleware.ts` |
| `admin-middleware` | Reject non-admin users (requires `auth-middleware` upstream) | `packages/api/src/middleware/admin-middleware.ts` |
| Services | Pure factory functions returning an object of methods; no DI container, no singletons | `packages/api/src/services/*-service.ts` |
| `lib/id-utils.ts` | `generateId()` (UUID v4) | `packages/api/src/lib/id-utils.ts` |
| `config/pricing-config.ts` | Per-model USD cents per 1M tokens, with default fallback | `packages/api/src/config/pricing-config.ts` |
| `config/admin-config.ts` | Hard-coded admin email | `packages/api/src/config/admin-config.ts` |
| `db/schema.sql` | Current schema (mirror of migrations) | `packages/api/src/db/schema.sql` |
| `db/migrations/` | Numbered D1 migrations | `packages/api/src/db/migrations/00*.sql` |
| `types/openai-types.ts` | OpenAI request/response/stream types | `packages/api/src/types/openai-types.ts` |
| `types/anthropic-types.ts` | Anthropic types (translated to OpenAI before forward) | `packages/api/src/types/anthropic-types.ts` |
| `types/rag-types.ts` | RAG config + vector search types | `packages/api/src/types/rag-types.ts` |
| `services/__tests__/` | Vitest unit tests for billing, JWT, OTP, token-counter | `packages/api/src/services/__tests__/*.test.ts` |
| Dashboard pages | Astro file-based routing, mount layout + React island | `packages/dashboard/src/pages/**/*.astro` |
| Dashboard layouts | Page chrome (sidebar nav, fonts, design tokens) | `packages/dashboard/src/layouts/*.astro` |
| React islands | Interactive components (OTP form, charts, admin tables) | `packages/dashboard/src/components/*.tsx` |
| `api-client.ts` | Typed fetch wrapper; reads `token` cookie; redirects on 401 | `packages/dashboard/src/lib/api-client.ts` |
| `styles/tokens.css` | IBM Carbon-inspired CSS custom properties | `packages/dashboard/src/styles/tokens.css` |
| `deploy.sh` | One-shot `pnpm install` → D1 migrate → dashboard build → Worker deploy | `deploy.sh` |
| `pnpm-workspace.yaml` | Declares `packages/*` workspace | `pnpm-workspace.yaml` |
| `tsconfig.base.json` | Shared TS compiler options (strict, ES2022, bundler resolution) | `tsconfig.base.json` |

## Pattern Overview

**Overall:** Layered, modular monolith on Cloudflare Workers + file-based-routed static frontend.

**Key Characteristics:**

- **Service-factory pattern.** Every service is a function `createXService(deps): XService` that closes over dependencies (DB, R2, AI, etc.) and returns an object of methods. No classes, no DI container — dependencies are passed explicitly per request from the route handler. Stateless across requests, no module-level mutables.
- **One Hono app, many sub-routers.** `index.ts` calls `app.route("/prefix", createXxxRoutes())` for each domain. Each sub-router is built inside a `createXxxRoutes()` factory that owns its middleware and handlers.
- **Two auth schemes on two surfaces.** API gateway routes use `Bearer sk-…` (api-key-middleware → rate-limit). Dashboard routes use `Bearer <jwt>` (auth-middleware → optional admin-middleware). Webhooks use `Authorization: Apikey <secret>`.
- **Worker as static asset host.** The dashboard is `astro build` (static SSG); the API Worker serves it via `assets` binding in `wrangler.toml` with `run_worker_first = true`. The catch-all `app.all("*", c.env.ASSETS.fetch)` returns the SPA shell.
- **D1 as the only SQL store; everything else is object/blob storage.** D1 holds users, API keys, usage logs, OTP, topup records. R2 holds RAG document chunks and payment-proof uploads. Vectorize holds the embedding index. Workers AI provides both embeddings (`@cf/bge-base-en-v1.5`, 768-dim) and inference via AI Gateway.
- **Streaming passthrough.** Gateway responses can be SSE; usage logging and balance deduction for streamed calls happen inside `c.executionCtx.waitUntil(...)` so the client stream is not blocked.
- **Astro islands.** The dashboard renders 95% HTML at build time; only four components are React islands with `client:load` (otp-form, usage-chart, admin-user-table, admin-transaction-table). No client-side routing — every page is a separate `.astro` file.

## Layers

**`routes/` — HTTP boundary.**
- Purpose: Translate Hono `Context` into domain operations; bind middleware; shape JSON responses.
- Location: `packages/api/src/routes/`
- Contains: 12 route files. Each is a `createXxxRoutes()` factory returning a `Hono` sub-router.
- Depends on: `middleware/`, `services/`, `types/`, `lib/`, `config/`.
- Used by: `index.ts`.

**`middleware/` — Cross-cutting HTTP filters.**
- Purpose: Authenticate, rate-limit, authorize.
- Location: `packages/api/src/middleware/`
- Contains: 4 files. Each exports a `createXxxMiddleware(deps?)()` factory returning a Hono middleware function.
- Depends on: `services/jwt-service`, D1 directly (for api-key lookup + user status).
- Used by: `routes/`.

**`services/` — Domain logic.**
- Purpose: Pure business logic. No HTTP awareness. Take dependencies as factory args.
- Location: `packages/api/src/services/`
- Contains: 16 service files + `__tests__/` (4 test files).
- Depends on: D1 SQL strings, Cloudflare binding types (`Ai`, `R2Bucket`, `VectorizeIndex`), `lib/`, `config/`, `types/`.
- Used by: `routes/`, `middleware/`.

**`lib/` — Stateless utilities.**
- Purpose: Tiny helpers that don't warrant a service.
- Location: `packages/api/src/lib/`
- Contains: 1 file (`id-utils.ts`).
- Depends on: Web Crypto API.
- Used by: `services/`, `routes/`.

**`config/` — Static lookup tables / constants.**
- Purpose: Compile-time constants (pricing table, admin email).
- Location: `packages/api/src/config/`
- Contains: 2 files.
- Depends on: nothing.
- Used by: `services/`, `routes/`.

**`types/` — TypeScript-only declarations.**
- Purpose: Shared request/response shapes.
- Location: `packages/api/src/types/`
- Contains: 3 files (`openai-types.ts`, `anthropic-types.ts`, `rag-types.ts`).
- Depends on: nothing.
- Used by: `routes/`, `services/`.

**`db/` — Schema + migrations.**
- Purpose: SQL DDL. `schema.sql` mirrors migrations for fresh setups.
- Location: `packages/api/src/db/`
- Contains: `schema.sql` + `migrations/001-initial.sql`, `002-admin-role.sql`, `003-user-status-and-proof.sql`.
- Depends on: nothing in code (applied out-of-band by `wrangler d1 migrations apply`).
- Used by: deploy script, all SQL string literals throughout `services/` and `routes/`.

**Dashboard `pages/` — File-routed views.**
- Purpose: Server-rendered (at build time, static) HTML entry points.
- Location: `packages/dashboard/src/pages/`
- Contains: 1 root page (`login.astro`) + `dashboard/{usage,billing,api-keys,profile}.astro` + `dashboard/admin/{users,transactions}.astro`.
- Depends on: `layouts/`, `components/`.
- Used by: Astro build → `packages/dashboard/dist/` → served by Worker via `ASSETS` binding.

**Dashboard `layouts/` — Page chrome.**
- Purpose: HTML shell, sidebar, design tokens import.
- Location: `packages/dashboard/src/layouts/`
- Contains: `auth-layout.astro` (centered card) and `dashboard-layout.astro` (sidebar nav + role-based admin link + logout).
- Depends on: `styles/tokens.css`.
- Used by: every `pages/*.astro`.

**Dashboard `components/` — React islands.**
- Purpose: Interactive client-side UI that the static HTML shell can't do alone.
- Location: `packages/dashboard/src/components/`
- Contains: 4 `.tsx` files (otp-form, usage-chart, admin-user-table, admin-transaction-table). All use `client:load` directive in the parent `.astro`.
- Depends on: `lib/api-client.ts`.
- Used by: `pages/`.

**Dashboard `lib/` — Typed API wrapper.**
- Purpose: Centralize fetch + token-cookie handling + 401 redirect.
- Location: `packages/dashboard/src/lib/api-client.ts`
- Contains: 1 file. ~130 lines of typed `request<T>()` + `api` namespace.
- Depends on: `import.meta.env.PUBLIC_API_URL` (Astro env), `document.cookie`.
- Used by: every React island; some `.astro` files still do raw `fetch` with `getToken()` (see CONCERNS).

**Dashboard `styles/` — Design tokens.**
- Purpose: Single source of truth for colors, spacing, typography.
- Location: `packages/dashboard/src/styles/tokens.css`
- Contains: 1 file. IBM Carbon-inspired CSS custom properties.
- Depends on: nothing.
- Used by: every `.astro` and `.tsx` via direct `var(--...)` references in inline styles.

## Data Flow

### Primary Request Path — OpenAI-compatible gateway call

1. Client → `POST /v1/chat/completions` with `Authorization: Bearer sk-…` (`packages/api/src/index.ts:47`)
2. Hono dispatches into `createOpenAIRoutes()` router (`packages/api/src/routes/openai-routes.ts:19`).
3. `api-key-middleware` (`packages/api/src/middleware/api-key-middleware.ts:36`) — SHA-256 hashes the key, looks up `api_keys` row, rejects if revoked, sets `c.set("userId"|"apiKeyId"|"apiKeyName")`, updates `last_used_at`.
4. `rate-limit-middleware` (`packages/api/src/middleware/rate-limit-middleware.ts:14`) — in-memory counter, 60 req/min per `apiKeyId`.
5. Route handler (`packages/api/src/routes/openai-routes.ts:33`) parses `OpenAIRequest`, estimates input tokens via `estimateMessagesTokens()`.
6. `createBillingService().checkSufficientBalance(DB, userId, estimatedCost)` rejects with HTTP 402 if underfunded (`packages/api/src/services/billing-service.ts:77`).
7. `createRAGService({ai, r2, vectorize}).enrichMessages(messages, ragConfig)`:
   - Embeds the last user message via `createEmbeddingService(ai).embed()` → `ai.run("@cf/bge-base-en-v1.5", …)`.
   - Queries `createVectorizeService(vectorize).query()` for top-K matches above threshold.
   - Fetches chunk text from `createR2StorageService(r2).getObject()`.
   - Builds context block via `createContextBuilderService().buildContext()`.
   - Prepends/merges as a system message.
   (`packages/api/src/services/rag-service.ts:47`–132)
8. `createGatewayService({gatewayId}).forwardRequest(enrichedBody)` → `fetch("https://gateway.ai.cloudflare.com/v1/{id}/openai/chat/completions", …)` (`packages/api/src/services/gateway-service.ts:22`).
9. Compute `cost_cents` via `calculateCost()` (`packages/api/src/services/token-counter-service.ts:3`).
10. `INSERT INTO usage_logs …` + `deductBalance()` in D1 (`packages/api/src/routes/openai-routes.ts:101–110`).
11. Return OpenAI JSON response.

For `stream: true`, steps 10–11 move into `c.executionCtx.waitUntil(...)` and the raw `Response` body is piped back as `text/event-stream` (`packages/api/src/routes/openai-routes.ts:73–93`).

### Dashboard page load

1. Browser requests `/dashboard/usage` → Worker catch-all `app.all("*", c.env.ASSETS.fetch(req))` (`packages/api/src/index.ts:66`).
2. Static `dist/dashboard/usage/index.html` served from R2-backed `ASSETS` binding.
3. `<UsageChart client:load />` island hydrates React (`packages/dashboard/src/pages/dashboard/usage.astro:7`).
4. `UsageChart` calls `api.getDailyUsage(30)` (`packages/dashboard/src/components/usage-chart.tsx:17`).
5. `api-client.ts` reads `document.cookie` for `token=…` and calls `fetch("/api/usage/daily?days=30", { headers: { Authorization: "Bearer …" } })`.
6. Worker dispatches `/api/usage/daily` → `createUsageRoutes()` → `auth-middleware` validates JWT → handler returns JSON.
7. React renders the SVG-less bar chart from the JSON.

### OTP login

1. `POST /api/auth/otp/send { email }` (`packages/api/src/routes/auth-routes.ts:18`).
2. `createOtpService(DB).generateOtp(email)` checks rate limit (3 / 10 min), generates 6-digit code, inserts `otp_codes` row (`packages/api/src/services/otp-service.ts:42`).
3. `createEmailService(from, apiKey).sendOtp(email, code)` — calls Emailit API or logs to console if no key (`packages/api/src/services/email-service.ts:16`).
4. `POST /api/auth/otp/verify { email, code }` (`packages/api/src/routes/auth-routes.ts:44`).
5. `validateOtp()` checks expiry, increments attempt_count, marks used (`packages/api/src/services/otp-service.ts:63`).
6. If user absent, `INSERT INTO users` with role = `ADMIN_EMAIL` ? "admin" : "user" (`packages/api/src/routes/auth-routes.ts:71`).
7. `createJwtService(secret).sign({userId, email, role})` — HS256 JWT, 1h expiry (`packages/api/src/services/jwt-service.ts:50`).
8. Return `{ token, user }`. Dashboard stores in cookie (`packages/dashboard/src/components/otp-form.tsx:32`).

### SePay webhook (bank-transfer topup)

1. SePay POSTs `/api/webhooks/sepay` with `Authorization: Apikey <SEPAY_WEBHOOK_SECRET>` (`packages/api/src/routes/webhook-routes.ts:27`).
2. Verify header. Reject with 401 on mismatch.
3. Filter to inbound transfers with `payload.id` and amount; ignore others (acknowledge 200).
4. Idempotency: skip if a `topup_records` row with same `sepay_transaction_id` is already `confirmed`.
5. Match `payload.code ?? extractTransactionCode(payload.content)` against a pending `topup_records` row.
6. `vndToUsdCents(payload.transferAmount)` and `billing.addCredit()` to bump `users.balance_cents`.
7. Mark `topup_records.status = 'confirmed'`, set `confirmed_at` (`packages/api/src/routes/webhook-routes.ts:74–84`).

**State Management:**

- **No client-side state library** on the dashboard. Each `.astro` page re-fetches on load; React islands hold local `useState` only.
- **No server-side state cache.** D1 is the only source of truth; every request hits D1.
- **In-process rate-limit state** is a module-level `Map` in `rate-limit-middleware.ts:12` — single-worker only, lost on redeploy. See CONCERNS.

## Key Abstractions

**`Service` factory function.**
- Purpose: Construct a domain object with its dependencies bound.
- Examples: `createBillingService()`, `createOtpService(db)`, `createRAGService({ai, r2, vectorize})`, `createGatewayService({gatewayId})`.
- Pattern: `export function createXService(deps): XService { … return { method1, method2, … }; }`

**Cloudflare `Bindings` type.**
- Purpose: Strongly-typed `c.env` per route group.
- Examples: Every route file declares its own `type Bindings = { DB: D1Database; R2: R2Bucket; … }` local to the file. Hono is parameterized as `new Hono<{ Bindings: Bindings }>()`.
- Pattern: Subset of the root `Bindings` in `index.ts` (the root type also includes `JWT_SECRET`, `ENVIRONMENT`, `SEPAY_*`, `EMAILIT_API_KEY`, `ASSETS`).

**Service interfaces (`*Service` type).**
- Purpose: Type contract for each factory.
- Examples: `OtpService`, `JwtService`, `BillingService`, `EmailService`, `RAGService`, `GatewayService`, `R2StorageService`, `VectorizeService`, `EmbeddingService`, `ContextBuilderService`, `UsageService`, `SepayService`, `IndexerService`, `ProofValidationResult`.
- Pattern: `export interface XService { methodA(...): Promise<…>; methodB(...): …; }`.

**Hono context variables (`ContextVariableMap` extension).**
- Purpose: Type the per-request auth state.
- Examples: `api-key-middleware.ts:3` adds `userId`, `apiKeyId`, `apiKeyName`; `auth-middleware.ts:11` adds `user: AuthUser`.
- Pattern: `declare module "hono" { interface ContextVariableMap { … } }`.

**OpenAI ↔ Anthropic translation.**
- Purpose: Reuse the same AI Gateway + RAG pipeline for both API shapes.
- Examples: `anthropic-routes.ts:71–84` collapses `messages[].content[]` blocks to strings, prepends `system` as a `system` message, then forwards the same OpenAI-shaped body to the gateway.
- Pattern: Anthropic request → OpenAI-shaped internal type → gateway fetch → Anthropic-shaped response.

## Entry Points

**API Worker entry — `packages/api/src/index.ts`.**
- Triggers: Every HTTP request to the Worker.
- Responsibilities: Apply CORS + logger globally, mount 9 sub-routers under their prefixes, expose `/health`, redirect `/` to `/login`, fall through unmatched paths to `ASSETS.fetch` (the dashboard shell). Exports `default app` for Wrangler.

**Dashboard entry — `packages/dashboard/src/pages/login.astro`.**
- Triggers: Browser navigates to `/login`.
- Responsibilities: Mount `<AuthLayout>` + `<OtpForm client:load />`. (The other "entry" is the Worker catch-all serving the built static HTML.)

**Admin reindex — `POST /api/admin/reindex` in `packages/api/src/routes/admin-routes.ts:26`.**
- Triggers: Admin POSTs JSON `{ prefix?: string }`.
- Responsibilities: Spawn index rebuild via `c.executionCtx.waitUntil(indexer.runIndex(prefix))`; return 202 immediately. Indexing can take a while.

**RAG indexer — `runIndex()` in `packages/api/src/services/indexer-service.ts:58`.**
- Triggers: Invoked from the admin reindex route.
- Responsibilities: List R2 objects (optionally by prefix), chunk text (500-token chunks, 50-token overlap), embed via Workers AI in batches of 10, upsert to Vectorize with metadata `{r2_key, chunk_index, preview}`. Used to build the RAG corpus; not invoked per-request.

## Architectural Constraints

- **Threading:** Single-threaded event loop per Worker isolate. No worker threads. `c.executionCtx.waitUntil()` is used to fire-and-forget async work after the response has been sent (streaming usage logging, indexing).
- **Global state:**
  - `packages/api/src/middleware/rate-limit-middleware.ts:12` — module-level `Map<string, {count, resetAt}>`. Resets on every redeploy. Not shared across Worker isolates in production (multi-isolate behavior).
  - `packages/api/src/config/admin-config.ts:1` — hard-coded `ADMIN_EMAIL = "ngoclam.lai@gmail.com"`. No env override.
- **Circular imports:** None observed. Service files import their helpers (`lib/`, `config/`, `types/`) but never siblings. Routes import services, never the other way around.
- **D1-only SQL.** No ORM. Every query is a hand-written `db.prepare("…").bind(…).first/all/run()`. No transactions are opened; multi-step writes (e.g., add credit + mark confirmed) are separate calls.
- **Two auth schemes, two token stores.** `api_keys` table holds SHA-256 hashes of `sk-…` keys; `users` table drives JWTs (HS256 with `JWT_SECRET`). Never mixed — `auth-middleware` always reads `users`, `api-key-middleware` always reads `api_keys`.
- **No server-side streaming state for the worker host.** The dashboard uses `output: "static"` (`packages/dashboard/astro.config.mjs:5`) — no SSR adapter. All data fetching happens client-side after hydration.

## Anti-Patterns

### Inline raw `fetch` in `.astro` pages

**What happens:** `packages/dashboard/src/pages/dashboard/{profile,usage,billing,api-keys}.astro` re-implement `getToken()` and call `fetch("/api/…")` with hand-rolled `Authorization` headers instead of using the typed `api` namespace in `packages/dashboard/src/lib/api-client.ts`.

**Why it's wrong:** Bypasses the 401-redirect-to-`/login` behavior in `api-client.ts:30`, duplicates the cookie-reading regex, and drops the typed response shape. Inconsistent with the React islands that *do* use `api`.

**Do this instead:** For islands, use `api.xxx()`. For new `.astro` pages that need client-side fetch, either promote the logic to a React island or extract the cookie/fetch helper from `api-client.ts` into a separate module that both can import.

### Hand-written SQL strings scattered across `services/` and `routes/`

**What happens:** SQL like `INSERT INTO usage_logs (id, user_id, api_key_id, model, input_tokens, output_tokens, cost_cents) VALUES (?, ?, ?, ?, ?, ?, ?)` is duplicated verbatim in `openai-routes.ts:77`, `anthropic-routes.ts:103`, and `usage-service.ts:47`.

**Why it's wrong:** Schema changes require touching every copy. Easy to drift (e.g., add a column, forget one site).

**Do this instead:** Centralize query strings inside the service that owns the table. `usage-service.ts` already has `logUsage()` for this — call it from the route handlers instead of inlining the SQL.

### Module-level `Map` for rate limiting

**What happens:** `packages/api/src/middleware/rate-limit-middleware.ts:12` declares `const counters = new Map<string, { count: number; resetAt: number }>()` at module scope.

**Why it's wrong:** In production, a Worker may run across multiple isolates; the Map is per-isolate, so the effective limit is `60 req/min × N isolates`. The map also resets on every redeploy.

**Do this instead:** Use D1 (`INSERT … ON CONFLICT …` counter row) or Cloudflare Durable Objects for globally consistent counters.

### Hard-coded `ADMIN_EMAIL`

**What happens:** `packages/api/src/config/admin-config.ts:1` exports a single Gmail address as the bootstrap admin.

**Why it's wrong:** A config change requires a code change. No way to onboard a second admin without a migration.

**Do this instead:** Read from `c.env.ADMIN_EMAIL` (set in `wrangler.toml [vars]` or `[env.production.vars]`). Promote to a `users` table `role='admin'` row once any admin exists.

## Error Handling

**Strategy:** Per-handler try/catch returning JSON `{ error: string }` with the appropriate HTTP status. No global error middleware observed.

**Patterns:**

- Auth failures → 401 with `{ error: "Unauthorized: …" }` (see `auth-middleware.ts:27`, `api-key-middleware.ts:41, 55, 59`).
- Forbidden (revoked key, deactivated user, non-admin) → 403 with `{ error: "Forbidden: …" }`.
- Insufficient balance → 402 (`openai-routes.ts:47`, `anthropic-routes.ts:59`).
- Rate limit → 429 with `{ error, retryAfter }` (`rate-limit-middleware.ts:30`).
- Bad input → 400 with descriptive message (e.g., `auth-routes.ts:21`, `billing-routes.ts:50`).
- Not found → 404 (`profile-routes.ts:24`, `admin-user-routes.ts:42`).
- Validation failures → 400 (`billing-proof-routes.ts:33, 49`).
- Unhandled exceptions → 500 with `{ error: err.message }` and `console.error(…)` (`openai-routes.ts:114`, `anthropic-routes.ts:159`).
- Streaming usage logging errors are swallowed (`.catch((err) => console.error(…))`) so a failed log write doesn't break the user stream (`openai-routes.ts:82`).
- The SePay webhook intentionally returns `{ success: true }` 200 even on internal errors to avoid SePay retry storms (`webhook-routes.ts:89`).
- Email send failures throw `EMAIL_SEND_FAILED` from the Emailit path; the auth route catches and converts to 500 (`auth-routes.ts:39`).

## Cross-Cutting Concerns

**Logging:** `hono/logger` middleware registered globally (`packages/api/src/index.ts:37`) — one-line-per-request to stdout. Plus ad-hoc `console.error()` in service error paths and route handlers.

**Validation:** Ad-hoc in route handlers (e.g., `email.includes("@")` at `auth-routes.ts:21`, allowed-status array check at `admin-user-routes.ts:30`, file-size + MIME-type check at `proof-upload-service.ts:9`). No schema validator (Zod / Valibot / etc.) in the codebase.

**Authentication:** Two distinct schemes. JWT (HS256) for dashboard sessions, `sk-…` SHA-256-hashed API keys for gateway calls. Both verified in middleware; both look up the user status / revocation state in D1.

**CORS:** Hard-coded to allow `http://localhost:4321` (Astro dev server) only (`packages/api/src/index.ts:34`). Production dashboard is served from the same origin via the `ASSETS` binding, so CORS only matters for local dev.

**Asset serving:** `run_worker_first = true` in `wrangler.toml:39` means the Worker handles every request first and decides whether to delegate to `ASSETS`. The `app.all("*", c.env.ASSETS.fetch(req))` catch-all is the delegation step.

**Secrets:** D1/R2/Vectorize/AI are bindings in `wrangler.toml`. Secrets (`JWT_SECRET`, `EMAILIT_API_KEY`, `SEPAY_*`) live in `.dev.vars` for local dev and are set via `wrangler secret put` for production. `.dev.vars` is git-ignored.
