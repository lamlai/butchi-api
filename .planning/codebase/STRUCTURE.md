# Codebase Structure

**Analysis Date:** 2026-06-04

## Directory Layout

```
butchi-api/
├── packages/
│   ├── api/                    # Hono Worker — AI gateway + dashboard API
│   │   ├── src/
│   │   │   ├── index.ts        # Hono app entry; mounts all sub-routers + ASSETS fallback
│   │   │   ├── routes/         # 12 route files; HTTP boundary
│   │   │   ├── services/       # 16 services + __tests__/ (4 test files)
│   │   │   ├── middleware/     # 4 middleware factories (auth, api-key, rate-limit, admin)
│   │   │   ├── lib/            # 1 file: id-utils.ts (UUID generator)
│   │   │   ├── db/             # schema.sql + migrations/
│   │   │   ├── config/         # pricing-config.ts, admin-config.ts
│   │   │   └── types/          # openai-types.ts, anthropic-types.ts, rag-types.ts
│   │   ├── package.json        # name: @butchi/api
│   │   ├── wrangler.toml       # Cloudflare bindings (D1, R2, Vectorize, AI, AI Gateway)
│   │   └── vitest.config.ts    # Vitest config for services/__tests__/
│   └── dashboard/              # Astro static + React islands — customer dashboard
│       ├── src/
│       │   ├── pages/          # File-based routes: login.astro + dashboard/*.astro
│       │   ├── components/     # 4 React islands: otp-form, usage-chart, admin-* tables
│       │   ├── layouts/        # auth-layout.astro, dashboard-layout.astro
│       │   ├── lib/            # api-client.ts (typed fetch wrapper)
│       │   ├── styles/         # tokens.css (IBM Carbon design tokens)
│       │   └── env.d.ts        # Astro env type reference
│       ├── astro.config.mjs    # output: "static", React integration
│       └── package.json        # name: @butchi/dashboard
├── docs/                       # Project-level documentation (not generated)
│   ├── codebase-summary.md     # High-level package overview
│   ├── system-architecture.md  # Component diagram + request flow notes
│   └── journals/               # Session journals
├── plans/                      # GSD planning artifacts (phases, reports)
├── .planning/codebase/         # GSD codebase map output (this file's home)
├── .claude/                    # Claude agent config (skills, settings)
├── .dev.vars.example          # Template for local secrets (copy → .dev.vars)
├── .gitignore                  # Excludes node_modules, dist, .dev.vars, .wrangler, .astro
├── deploy.sh                   # One-shot deploy: install → migrate → build → wrangler deploy
├── package.json                # Root: workspace scripts (dev, build, lint, typecheck)
├── pnpm-workspace.yaml         # packages/* + allowBuilds (esbuild, sharp, workerd)
└── tsconfig.base.json          # Shared TS compiler options (strict, ES2022, bundler)
```

## Directory Purposes

**`packages/api/src/routes/`:**
- Purpose: HTTP boundary. Each `createXxxRoutes()` factory returns a Hono sub-router. Mounted in `index.ts` under a path prefix.
- Contains: 12 route files, all under 200 lines. Mix of gateway, dashboard-API, admin, and webhook routes.
- Key files:
  - `openai-routes.ts` — `POST /v1/chat/completions` (api-key + rate-limit + RAG + gateway proxy)
  - `anthropic-routes.ts` — `POST /v1/messages` (translates to OpenAI, same pipeline)
  - `auth-routes.ts` — `POST /api/auth/otp/send` and `/verify` (issues JWT)
  - `admin-routes.ts` — Mounts sub-routers + `POST /reindex` (sparks indexer)
  - `admin-user-routes.ts` — `GET /api/admin/users`, `PATCH /:id/status`
  - `admin-transaction-routes.ts` — `GET /`, `POST /:id/confirm`, `POST /:id/reject`
  - `billing-routes.ts` — `GET /api/billing`, `/history`, `POST /topup` (SePay QR)
  - `billing-proof-routes.ts` — `POST /:id/proof` (multipart upload to R2), `GET /:id/proof` (serve)
  - `api-key-routes.ts` — `GET/POST /api/keys`, `DELETE /:id`
  - `usage-routes.ts` — `GET /api/usage`, `/history`, `/daily`
  - `profile-routes.ts` — `GET/PUT /api/profile`
  - `webhook-routes.ts` — `POST /api/webhooks/sepay`

**`packages/api/src/services/`:**
- Purpose: Pure domain logic. Each file is a `createXService(deps)` factory.
- Contains: 16 service files + 1 `__tests__/` subdirectory.
- Key files:
  - `billing-service.ts` — `calculateCost`, `getBalance`, `deductBalance`, `addCredit`, `checkSufficientBalance`, `vndToUsdCents`
  - `gateway-service.ts` — `forwardRequest`, `forwardStreamRequest`, `estimateMessagesTokens`
  - `rag-service.ts` — `enrichMessages`, `parseConfig` (orchestrates embedding + vectorize + R2 + context-builder)
  - `jwt-service.ts` — HS256 sign/verify (no external dep, uses Web Crypto)
  - `otp-service.ts` — generate, validate, rate-limit, attempt counting
  - `email-service.ts` — Emailit API client for OTP + admin proof notifications
  - `indexer-service.ts` — RAG corpus builder (R2 → chunk → embed → Vectorize)
  - `embedding-service.ts` — Workers AI `@cf/bge-base-en-v1.5` wrapper
  - `vectorize-service.ts` — Vectorize query + upsert wrapper
  - `r2-storage-service.ts` — R2 list + get wrapper
  - `context-builder-service.ts` — Token-budget-aware context block assembler
  - `usage-service.ts` — usage_logs query/aggregate helpers
  - `sepay-service.ts` — VietQR URL builder + webhook signature verify
  - `token-counter-service.ts` — `calculateCost` (USD cents from tokens)
  - `proof-upload-service.ts` — file validation (size + MIME) + R2 key builder

**`packages/api/src/services/__tests__/`:**
- Purpose: Vitest unit tests for services with deterministic logic.
- Contains: 4 test files (`billing-service.test.ts`, `jwt-service.test.ts`, `otp-service.test.ts`, `token-counter-service.test.ts`).
- Pattern: Mocks D1 via a hand-written `vi.fn()` chain that mimics `prepare().bind().first()/run()`.

**`packages/api/src/middleware/`:**
- Purpose: Cross-cutting HTTP filters.
- Contains: 4 files.
- Key files:
  - `api-key-middleware.ts` — `Bearer sk-…` SHA-256 lookup; also exports `generateApiKey`, `hashKey`, `getKeyPrefix` helpers (used by `api-key-routes.ts`).
  - `auth-middleware.ts` — JWT verify, user-status check, sets `c.get("user")`.
  - `rate-limit-middleware.ts` — In-memory 60-req/min sliding window.
  - `admin-middleware.ts` — Role check (must run after `auth-middleware`).

**`packages/api/src/db/`:**
- Purpose: SQL DDL.
- Contains: `schema.sql` (full schema) + `migrations/001-initial.sql`, `002-admin-role.sql`, `003-user-status-and-proof.sql`.
- Key files:
  - `migrations/001-initial.sql` — `users`, `otp_codes`, `api_keys`, `usage_logs`, `billing_records`, `topup_records` + 7 indexes.
  - `migrations/002-admin-role.sql` — `ALTER TABLE users ADD COLUMN role`.
  - `migrations/003-user-status-and-proof.sql` — `users.status`, `topup_records.proof_url`.

**`packages/api/src/config/`:**
- Purpose: Static constants.
- Key files:
  - `pricing-config.ts` — `PRICING` map (gpt-4o, gpt-4o-mini, llama-3.3-70b) + `getModelPrice()` fallback.
  - `admin-config.ts` — Hard-coded `ADMIN_EMAIL` constant.

**`packages/api/src/lib/`:**
- Purpose: Tiny stateless helpers.
- Key files:
  - `id-utils.ts` — `generateId()` wraps `crypto.randomUUID()`.

**`packages/api/src/types/`:**
- Purpose: Shared TypeScript shapes.
- Key files:
  - `openai-types.ts` — `OpenAIMessage`, `OpenAIRequest`, `OpenAIResponse`, `OpenAIStreamChunk`.
  - `anthropic-types.ts` — `AnthropicMessage`, `AnthropicRequest`, `AnthropicResponse`, `AnthropicStreamEvent`.
  - `rag-types.ts` — `RAGConfig`, `VectorSearchResult`, `ChunkContent`.

**`packages/dashboard/src/pages/`:**
- Purpose: File-based Astro routes. Each `.astro` is a separate page.
- Contains:
  - `login.astro` — `/login`, mounts `<OtpForm client:load />`.
  - `dashboard/profile.astro` — `/dashboard/profile`, inline-script fetches `/api/profile`.
  - `dashboard/usage.astro` — `/dashboard/usage`, mounts `<UsageChart client:load />`.
  - `dashboard/billing.astro` — `/dashboard/billing`, inline-script fetches `/api/billing` and `/api/billing/topup`.
  - `dashboard/api-keys.astro` — `/dashboard/api-keys`, inline-script CRUD on `/api/keys`.
  - `dashboard/admin/users.astro` — `/dashboard/admin/users`, mounts `<AdminUserTable client:load />`.
  - `dashboard/admin/transactions.astro` — `/dashboard/admin/transactions`, mounts `<AdminTransactionTable client:load />`.

**`packages/dashboard/src/components/`:**
- Purpose: React islands for interactive UI.
- Contains: 4 `.tsx` files.
- Key files:
  - `otp-form.tsx` — Two-step (email → 6-digit code) form, stores JWT in cookie on success.
  - `usage-chart.tsx` — Bar chart of last 14 days of `dailyData`, totals for 30d.
  - `admin-user-table.tsx` — Table with role/status pills, status-update actions.
  - `admin-transaction-table.tsx` — Filterable table (all/pending/confirmed/rejected) with confirm/reject actions.

**`packages/dashboard/src/layouts/`:**
- Purpose: HTML shell, shared chrome.
- Key files:
  - `auth-layout.astro` — Centered card, IBM Plex Sans, `tokens.css` import.
  - `dashboard-layout.astro` — Sidebar nav (Usage, Billing, API Keys, Profile + admin section), role-based admin nav reveal via inline script reading the JWT payload, logout button.

**`packages/dashboard/src/lib/`:**
- Purpose: Shared browser-side helpers.
- Key files:
  - `api-client.ts` — `request<T>()` + typed `api` namespace (sendOtp, verifyOtp, listKeys, createKey, revokeKey, getUsage, getUsageHistory, getDailyUsage, getBilling, getBillingHistory, createTopup, getProfile, updateProfile). Auto-redirects to `/login` on 401.

**`packages/dashboard/src/styles/`:**
- Purpose: Design tokens.
- Key files:
  - `tokens.css` — IBM Carbon-inspired CSS custom properties (colors, spacing, typography, radii).

## Key File Locations

**Entry Points:**
- `packages/api/src/index.ts` — Worker entry. Mounts all sub-routers + ASSETS fallback.
- `packages/dashboard/src/pages/login.astro` — First user-facing page.
- `packages/dashboard/astro.config.mjs` — Astro build configuration.

**Configuration:**
- `packages/api/wrangler.toml` — Cloudflare bindings (D1 id, R2 bucket, Vectorize index, AI Gateway id, ASSETS dir, env vars).
- `packages/api/vitest.config.ts` — Test config.
- `packages/dashboard/astro.config.mjs` — Astro output + integrations.
- `tsconfig.base.json` — Shared TS options.
- `pnpm-workspace.yaml` — Workspace + `allowBuilds`.
- `package.json` (root) — Workspace scripts.
- `.dev.vars.example` — Local dev secret template.
- `deploy.sh` — Production deploy script.

**Core Logic:**
- `packages/api/src/services/rag-service.ts` — RAG orchestration (embed → vectorize → R2 fetch → context build → system-prompt injection).
- `packages/api/src/services/gateway-service.ts` — AI Gateway proxy.
- `packages/api/src/services/billing-service.ts` — Balance + pricing.
- `packages/api/src/services/jwt-service.ts` — JWT sign/verify.
- `packages/api/src/services/indexer-service.ts` — RAG corpus builder.
- `packages/api/src/db/schema.sql` — D1 schema reference.
- `packages/dashboard/src/lib/api-client.ts` — Frontend API wrapper.

**Testing:**
- `packages/api/src/services/__tests__/billing-service.test.ts` — `calculateCost`, `checkSufficientBalance`, `getBalance`.
- `packages/api/src/services/__tests__/jwt-service.test.ts` — sign/verify, expiry, tampering, wrong secret.
- `packages/api/src/services/__tests__/otp-service.test.ts` — generate, validate, expiry, invalid code.
- `packages/api/src/services/__tests__/token-counter-service.test.ts` — `calculateCost` across models + `estimateMessagesTokens`.

## Naming Conventions

**Files:**
- Routes: `<domain>-routes.ts` (`openai-routes.ts`, `auth-routes.ts`, `admin-user-routes.ts`).
- Services: `<domain>-service.ts` (`billing-service.ts`, `gateway-service.ts`).
- Middleware: `<purpose>-middleware.ts` (`auth-middleware.ts`, `api-key-middleware.ts`).
- Tests: `<name>.test.ts` colocated under `__tests__/`.
- Types: `<api>-types.ts` (`openai-types.ts`).
- Config: `<domain>-config.ts` (`pricing-config.ts`).
- Astro pages: `<route>.astro` (`login.astro`, `profile.astro`).
- React components: `<kebab>.tsx` (`otp-form.tsx`, `admin-user-table.tsx`).
- SQL migrations: `NNN-<description>.sql` (`001-initial.sql`, `003-user-status-and-proof.sql`).

**Functions:**
- Factory functions: `createXService(deps): XService` (PascalCase service name + `Service` suffix).
- Middleware factories: `createXMiddleware(deps?)()`.
- Service methods: camelCase verbs (`getBalance`, `deductBalance`, `enrichMessages`, `forwardRequest`, `sendOtp`).
- Helper utilities: camelCase, descriptive (`generateId`, `calculateCost`, `vndToUsdCents`, `getModelPrice`, `validateProofFile`, `getProofR2Key`).

**Variables:**
- Module constants: UPPER_SNAKE_CASE (`PRICING`, `ADMIN_EMAIL`, `EMAILIT_URL`, `CHUNK_SIZE`, `MAX_SIZE`).
- SQL columns: snake_case (`user_id`, `api_key_id`, `created_at`, `balance_cents`, `sepay_transaction_id`).
- D1 column types always use `INTEGER` for booleans (0/1) and timestamps stored as ISO strings (`TEXT DEFAULT (datetime('now'))`).
- API request/response keys: snake_case for OpenAI/Anthropic compatibility; camelCase for internal JSON (`balance_cents` ↔ `totalTokens`).

**Types:**
- Service interface: `<Name>Service` (`BillingService`, `OtpService`).
- DTO / payload: `<Name>` or `<Name>Request/Response/Payload` (`OpenAIRequest`, `AnthropicResponse`, `SepayWebhookPayload`).
- Enum-like: `string` literal union (e.g., `"pending" | "confirmed" | "rejected"`, `"active" | "inactive" | "banned"`).

## Where to Add New Code

**New gateway route (e.g., `POST /v1/embeddings`):**
- Route file: `packages/api/src/routes/<api>-routes.ts` (e.g., `embeddings-routes.ts`)
- Mount in: `packages/api/src/index.ts` (add `app.route("/v1", createEmbeddingsRoutes())`)
- Reuse: `createApiKeyMiddleware`, `createRateLimitMiddleware`, `createEmbeddingService` from existing services.
- Tests: `packages/api/src/services/__tests__/embedding-service.test.ts` (if you add new logic to the service).

**New dashboard API route (e.g., `GET /api/projects`):**
- Route file: `packages/api/src/routes/<domain>-routes.ts`
- Mount in: `packages/api/src/index.ts` under `/api/<domain>`.
- Reuse: `createAuthMiddleware` (JWT). For admin-only, chain `createAdminMiddleware`.
- Add typed method to `packages/dashboard/src/lib/api-client.ts` (`api.listProjects()` etc.) so React islands can call it.

**New dashboard page (e.g., `/dashboard/projects`):**
- Page: `packages/dashboard/src/pages/dashboard/projects.astro`
- Layout: `packages/dashboard/src/layouts/dashboard-layout.astro` (already includes sidebar; just add a nav link there if you want it visible).
- If interactive: create `packages/dashboard/src/components/projects-view.tsx`, mount with `<ProjectsView client:load />` inside the `.astro`.
- Sidebar nav: edit `packages/dashboard/src/layouts/dashboard-layout.astro` to add `<a href="/dashboard/projects">`.

**New service (e.g., `project-service.ts`):**
- Service file: `packages/api/src/services/project-service.ts` — `export function createProjectService(db: D1Database): ProjectService { … return { method1, method2 }; }`.
- Types: `packages/api/src/types/project-types.ts` if there are non-trivial shapes.
- Tests: `packages/api/src/services/__tests__/project-service.test.ts`.

**New database table / column:**
- Create a new migration: `packages/api/src/db/migrations/NNN-<description>.sql` (next number).
- Update the reference: `packages/api/src/db/schema.sql` to mirror migrations.
- Apply locally: `pnpm --filter api exec wrangler d1 migrations apply butchi-db --local`.
- Apply production: `deploy.sh` (or `pnpm --filter api exec wrangler d1 migrations apply butchi-db --remote`).

**New design token:**
- Edit `packages/dashboard/src/styles/tokens.css` (e.g., add `--color-brand-new: #...`).
- Use in any component: `style={{ color: 'var(--color-brand-new)' }}`.

**New React island:**
- Create `packages/dashboard/src/components/<kebab>.tsx` (default export).
- Mount in a page: `import MyThing from "../../components/my-thing";` + `<MyThing client:load />`.
- For data: import `api` from `../lib/api-client` and call its methods.

**Utilities / shared helpers:**
- `packages/api/src/lib/` for backend helpers (one function per file).
- `packages/dashboard/src/lib/` for frontend helpers (extend `api-client.ts` or create a new file alongside it).
- Avoid sharing TS types across packages — there is no cross-package type export. Define types in both places or duplicate as needed.

## Special Directories

**`packages/api/src/services/__tests__/`:**
- Purpose: Co-located unit tests for services. Picked up by `vitest.config.ts` include pattern.
- Generated: No.
- Committed: Yes.

**`packages/api/src/db/migrations/`:**
- Purpose: Append-only D1 migration history. Apply with `wrangler d1 migrations apply`.
- Generated: No.
- Committed: Yes. Never edit a migration after it's been applied; create a new one.

**`docs/`:**
- Purpose: Project-level documentation (`codebase-summary.md`, `system-architecture.md`, journals). Hand-written, not generated.
- Generated: No.
- Committed: Yes.

**`plans/`:**
- Purpose: GSD planning artifacts (phase plans, audit reports, retros). Subdirectories per plan slug.
- Generated: Yes (by GSD commands).
- Committed: Yes (source of truth for "what was decided and when").

**`.planning/codebase/`:**
- Purpose: GSD codebase map output (`STACK.md`, `INTEGRATIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`).
- Generated: Yes (by `/gsd-map-codebase`).
- Committed: Yes.

**`.claude/`:**
- Purpose: Claude agent config (skills, settings, hooks).
- Generated: No.
- Committed: Yes. Do not modify the `~/.claude/skills` directory; modify the local `.claude/` instead.

**`packages/dashboard/dist/` (referenced in `wrangler.toml`):**
- Purpose: Astro build output. Served by the Worker via the `ASSETS` binding.
- Generated: Yes (`pnpm --filter dashboard build`).
- Committed: No (`.gitignore` excludes `dist/`).

**`packages/api/.wrangler/` (implicit from `.gitignore`):**
- Purpose: Wrangler local-dev state (miniflare workerd, bindings).
- Generated: Yes.
- Committed: No.
