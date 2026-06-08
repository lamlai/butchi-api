<!-- GSD:project-start source:PROJECT.md -->
## Project

**butchi-api**

B2D (Business-to-Developer) AI API Platform chạy trên Cloudflare, cung cấp OpenAI/Anthropic-compatible API cho end-user (developers) với RAG context tự động inject từ một shared knowledge base do admin quản lý. Developer mua credits bằng VND qua SePay QR, gọi API trả pay-per-token. Admin (lamlai) upload tài liệu lên R2 → hệ thống chunk + embed (Workers AI bge-base-en-v1.5) + index vào Vectorize; tất cả user cùng query KB đó. UI gồm Dashboard (Studio, Usage, Billing, API Keys, Profile) + Admin panel (Users, Transactions, KB Management) + Playground để test trước khi integrate.

**Core Value:** Developer VN có thể gọi AI API (OpenAI/Anthropic compatible) với RAG grounding từ shared knowledge base, trả tiền bằng VND (SePay) friction thấp, không cần setup multi-provider hay tự build RAG pipeline.

### Constraints

- **Stack**: Cloudflare Workers only — không được dùng AWS/GCP/Azure (admin đã commit CF ecosystem)
- **Frontend**: Astro static SSG + React islands — không SSR runtime (cost), không client-side routing (giữ đơn giản)
- **Database**: D1 SQLite only — không Postgres, không KV, không Durable Objects cho v1 (trừ rate limit nếu cần)
- **Embeddings**: Workers AI `@cf/bge-base-en-v1.5` (768-dim) — đồng bộ với Vectorize
- **Auth**: Email OTP only (Emailit) — không password, không OAuth cho v1
- **Payment**: SePay QR only — không Stripe, không VNPay cho v1 (focus VN market)
- **Currency display**: VND cho user-facing, USD cents nội bộ để tính cost
- **Design system**: IBM Carbon tokens (đã có `DESIGN.md`) — không switch sang Tailwind/Material/Ant
- **Model access**: Admin cung cấp API key upstream (OpenAI, Anthropic) — user không tự thêm key
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.6 (strict mode, ES2022 target) — all source code in `packages/api/src/` and `packages/dashboard/src/`
- SQL (SQLite dialect for D1) — schema/migrations in `packages/api/src/db/schema.sql`, `packages/api/migrations/`
- Astro server markup (`.astro` files) — layouts/pages in `packages/dashboard/src/pages/`, `packages/dashboard/src/layouts/`
- TSX (React 19) — interactive islands in `packages/dashboard/src/components/`
- Hono JSX (`hono/jsx` JSX import source) — declared in `packages/api/tsconfig.json` (available but not currently used in components)
## Runtime
- Cloudflare Workers (workerd) — primary runtime for `packages/api` via `wrangler.toml` (`compatibility_date = "2024-10-01"`, `compatibility_flags = ["nodejs_compat"]`)
- Node.js `>= 22` — declared in `engines` at `package.json` for local dev/test
- Browser (ES2022 output, ES modules) — `packages/dashboard` ships static assets
- pnpm 9+ workspaces — `pnpm-workspace.yaml` at repo root, `allowBuilds: esbuild, sharp, workerd`
- Lockfile: `pnpm-lock.yaml` present (committed)
## Frameworks
- Hono 4.6.0 — HTTP router in `packages/api/src/index.ts` (`new Hono<{ Bindings: Bindings }>()`)
- Astro 4.16.0 (static / SSG output, `output: "static"`) — `packages/dashboard/astro.config.mjs`
- React 19.2.7 + React-DOM 19.2.7 — client-side islands
- `@astrojs/react` 3.6.0 — React island integration in `packages/dashboard/astro.config.mjs`
- `@astrojs/check` 0.9.9 — typecheck script (`astro check`) in `packages/dashboard/package.json`
- Vitest 3.0.0 with `@cloudflare/vitest-pool-workers` 0.7.0 — `packages/api/vitest.config.ts`, runs in `node` env (not the worker pool currently)
- Test files: `packages/api/src/services/__tests__/*.test.ts` (4 files: `billing-service`, `jwt-service`, `otp-service`, `token-counter-service`)
- Wrangler 3.80.0 — Cloudflare Workers dev, deploy, and D1 migration runner
- TypeScript 5.6 compiler (tsc) — typecheck via `pnpm typecheck` at root and per package
## Key Dependencies
- `hono` 4.6.0 — only runtime dep
- Implicit (via Cloudflare bindings, not in `package.json`): D1Database, R2Bucket, Ai, VectorizeIndex, Fetcher (all from `@cloudflare/workers-types`)
- `astro` 4.16.0
- `react` 19.2.7, `react-dom` 19.2.7
- `@astrojs/react` 3.6.0
- `typescript` 5.6.0
- `@cloudflare/vitest-pool-workers` 0.7.0
- `@cloudflare/workers-types` 4.20241001.0
- `vitest` 3.0.0
- `wrangler` 3.80.0
- `@astrojs/check` 0.9.9
- `@types/react` 19.2.16
- `typescript` 5.6.0
## Configuration
- `target: "ES2022"`, `module: "ES2022"`, `moduleResolution: "bundler"`
- `strict: true`, `skipLibCheck: true`
- `noEmit: true` (wrangler/astro handle emit)
- `allowImportingTsExtensions: true`
- Extends base, `types: ["@cloudflare/workers-types"]`
- JSX configured: `jsx: "react-jsx"`, `jsxImportSource: "hono/jsx"`
- `rootDir: "src"`, `outDir: "dist"`
- Extends base, `types: ["astro/client"]`
- JSX configured: `jsx: "react-jsx"`, `jsxImportSource: "react"`
- `outDir: "dist"`
- `name = "butchi-api"`, `main = "src/index.ts"`
- Bindings: D1 `DB` (`butchi-db`, id `e4143f19-...`), R2 `R2` (`butchi-rag`), AI Gateway `AI_GATEWAY` (`butchi-gateway`), Workers AI `ai`, Vectorize `VECTORIZE` (`butchi-rag-index`), Assets `ASSETS` (serves `../dashboard/dist`)
- `nodejs_compat` flag enabled
- `[vars]` ENVIRONMENT, OTP_EMAIL_FROM
- `output: "static"` (pure SSG, no SSR runtime)
- `integrations: [react()]` (no cloudflare adapter — assets are served by the Worker via the ASSETS binding)
- `globals: true`, `environment: "node"`, `include: ["src/services/__tests__/**/*.test.ts"]`
- `JWT_SECRET`, `EMAILIT_API_KEY`, `OTP_EMAIL_FROM`, `ENVIRONMENT`
- `dev` / `dev:api` / `dev:dashboard` — parallel/individual dev
- `build` — `pnpm --filter api build && pnpm --filter dashboard build` (api uses `wrangler deploy --dry-run`, dashboard uses `astro build`)
- `lint` — `pnpm -r lint` (currently a no-op echo per package)
- `typecheck` — `pnpm -r typecheck`
- `pnpm install` → `wrangler d1 migrations apply butchi-db --remote` → `astro build` → `wrangler deploy` — single Worker serves both API and dashboard assets
## Platform Requirements
- Node.js >= 22 (root `engines` field)
- pnpm 9+ with workspace support
- Wrangler CLI (invoked via `pnpm --filter api exec wrangler ...`)
- macOS/Linux/WSL — `workerd` is listed under `allowBuilds` in `pnpm-workspace.yaml` (native binary)
- Cloudflare Workers (single Worker, runtime `workerd`)
- Cloudflare D1 (SQLite at edge)
- Cloudflare R2 (object storage)
- Cloudflare Vectorize (vector index)
- Cloudflare AI Gateway + Workers AI (inference + caching)
- Public URL: `https://butchi-api.ngoclamlai.workers.dev` (from `deploy.sh`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Services: `kebab-case-service.ts` (e.g., `billing-service.ts`, `jwt-service.ts`, `email-service.ts`) — `packages/api/src/services/`
- Routes: `kebab-case-routes.ts` (e.g., `auth-routes.ts`, `openai-routes.ts`, `billing-proof-routes.ts`) — `packages/api/src/routes/`
- Middleware: `kebab-case-middleware.ts` (e.g., `auth-middleware.ts`, `api-key-middleware.ts`, `rate-limit-middleware.ts`) — `packages/api/src/middleware/`
- Tests: `<name>.test.ts` co-located under `src/services/__tests__/` (e.g., `otp-service.test.ts`)
- Dashboard components: `kebab-case.tsx` (e.g., `admin-transaction-table.tsx`, `otp-form.tsx`)
- Dashboard pages: `kebab-case.astro` (e.g., `usage.astro`, `api-keys.astro`)
- Layouts: `kebab-case-layout.astro` (e.g., `dashboard-layout.astro`)
- Config: `kebab-case-config.ts` (e.g., `pricing-config.ts`, `admin-config.ts`)
- Factory functions: `createXxxService()` (e.g., `createBillingService()`, `createJwtService()`, `createEmbeddingService(ai)`) — return an interface with method bindings
- Middleware factories: `createXxxMiddleware()` returning `(c: Context, next: Next) => Promise<...>`
- Route factories: `createXxxRoutes()` returning a Hono router instance
- Helper utilities: camelCase verb phrases (e.g., `vndToUsdCents`, `extractEmbeddings`, `estimateMessagesTokens`, `validateProofFile`, `getProofR2Key`, `generateCode`, `hashKey`, `generateApiKey`, `getKeyPrefix`)
- Top-level `calculateCost(model, inputTokens, outputTokens)` for pure functions (see `packages/api/src/services/token-counter-service.ts`)
- SCREAMING_SNAKE_CASE for module-level constants (e.g., `TOKEN_EXPIRY_HOURS`, `ALG_HEADER`, `MAX_ATTEMPTS`, `VND_TO_USD_CENTS`, `CHUNK_SIZE`, `OTP_CODE_LENGTH`)
- camelCase for local variables, parameters, function-scoped bindings
- Underscore prefix for intentionally unused params: `_transactionId` (e.g., `addCredit` in `packages/api/src/services/billing-service.ts:69`)
- `PascalCase` for interfaces, types, and type aliases (e.g., `BillingService`, `JwtPayload`, `OtpEntry`, `AuthUser`, `Bindings`, `SepayWebhookPayload`)
- Service interfaces: noun phrase, no `I` prefix (e.g., `BillingService`, `OtpService`, `JwtService`, `EmbeddingService`, `GatewayService`)
- Configuration interfaces: `XxxConfig` or `XxxDeps` (e.g., `SepayConfig`, `GatewayConfig`, `RAGServiceDeps`, `ApiKeyMiddlewareDeps`)
## Code Style
- No Prettier, no ESLint, no Biome config files detected (`.prettierrc*`, `eslint.config.*`, `biome.json` are all absent)
- Both `packages/api` and `packages/dashboard` define `lint: "echo 'lint ok'"` — lint is currently a no-op stub
- `tsconfig.base.json` enables: `strict: true`, `skipLibCheck: true`, `esModuleInterop: true`, `isolatedModules: true`, `forceConsistentCasingInFileNames: true`, `target: "ES2022"`, `module: "ES2022"`, `moduleResolution: "bundler"`
- Observed 2-space indentation throughout
- Double quotes for strings (e.g., `"gpt-4o"`, `"auth-middleware"`)
- Trailing commas used in multi-line parameter lists and object literals
- Semicolons required at end of statements
- File-local helper functions are declared before the factory `createXxx` function and are not exported
- TypeScript types imported with `import type { ... }` when used only as types (e.g., `import type { ChunkContent } from "../types/rag-types"`)
- Explicit return type annotations on factory functions and inner closure functions (e.g., `Promise<number>`, `Promise<void>`)
- `as unknown as D1Database` casting pattern is used in tests to satisfy the `D1Database` global type
- Bindings are defined per file as a local `type Bindings = { ... }` rather than a shared type (see `packages/api/src/routes/auth-routes.ts:8`, `packages/api/src/index.ts:14`)
- `c.get("userId") as string` and `c.get("apiKeyId") as string` are used in routes (e.g., `packages/api/src/routes/openai-routes.ts:39-40`)
## Import Organization
- No path aliases (e.g., `@/` or `~`) are configured. All imports use relative paths (`../services/...`, `./sub-routes/...`).
- The `tsconfig.base.json` does not define `paths`.
- Always use `"./..."` for same-directory or `"./routes/admin-routes"` (omitting `.ts` extension; TypeScript handles resolution with `allowImportingTsExtensions`)
- `import.meta.env.PUBLIC_API_URL` is the only observed build-time env access (Astro convention; `packages/dashboard/src/lib/api-client.ts:1`)
- Not used. Each module exports named symbols directly; no `index.ts` re-exports within `services/`, `routes/`, `middleware/`.
## Error Handling
## Logging
- `console.log` is reserved for the email dev fallback when `emailitApiKey` is missing (e.g., `packages/api/src/services/email-service.ts:19, 50`)
- `console.error` is used in route catch blocks, service failure paths, and webhook mismatches (16 occurrences across `packages/api/src/`)
- Tag-style prefixes: `"[EMAIL] To: ..."` for dev-only email fallback
- No log levels (info/warn/debug) — only `log` and `error`
- No JSON structured logs
## Comments
- Block comments for module-level constants where units/format matter (e.g., `packages/api/src/services/billing-service.ts:4` `// Exchange rate: 1 USD ≈ 25,500 VND`)
- Inline comments to mark processing steps in long functions (e.g., `packages/api/src/services/indexer-service.ts:29` `// Keep overlap words`, `packages/api/src/services/rag-service.ts:75` `// Embed query`)
- Block comments for middleware behavior (e.g., `packages/api/src/middleware/rate-limit-middleware.ts:11` `// In-memory sliding window counter (adequate for single-worker, resets on redeploy)`)
- JSDoc only used on the Admin middleware file (`packages/api/src/middleware/admin-middleware.ts:3-7`)
- Sparse; only one formal JSDoc block observed (admin-middleware.ts)
- Most code relies on function names and types rather than JSDoc
## Function Design
- Most functions are < 50 lines. Route handlers are the largest, typically 40–100 lines.
- Helper functions in services are short and focused (e.g., `hmacSha256`, `base64UrlEncode`, `extractEmbeddings`)
- Object destructuring for > 2 parameters in service method signatures (e.g., `packages/api/src/services/usage-service.ts:5-13` `logUsage(db, params: { userId, apiKeyId, model, inputTokens, outputTokens, costCents })`)
- Dependency objects (deps pattern) used for services with multiple external clients (e.g., `packages/api/src/services/rag-service.ts:8-12` `RAGServiceDeps = { ai, r2, vectorize }`)
- Async functions return `Promise<T>`; never throw non-`Error` values
- Status codes embedded in Hono responses via `c.json(payload, status)`
- Validation helpers return `{ valid: boolean; error?: string }` discriminated unions (e.g., `packages/api/src/services/proof-upload-service.ts:4-7`)
- Inner arrow functions are assigned to `const` then returned as object literal (e.g., `packages/api/src/services/billing-service.ts:28-92`):
## Module Design
- One factory function (`createXxx`) per file, plus an interface describing the returned object
- Helper utilities may also be exported when reusable across modules (e.g., `generateApiKey`, `hashKey`, `getKeyPrefix` from `packages/api/src/middleware/api-key-middleware.ts:76`)
- Not used. No `index.ts` re-exports in `services/`, `routes/`, `middleware/`, or `types/`.
- Always named exports — no `export default` for service or route modules
- React components in the dashboard use `export default function ComponentName()` (e.g., `packages/dashboard/src/components/otp-form.tsx:4`)
## D1 / SQL Conventions
- All SQL is inline as template strings passed to `db.prepare(...)`
- `bind(...)` for parameter substitution; never string-concatenate user input into SQL
- `.first<T>()` for single-row selects with explicit generic type; `.all<T>()` for multi-row
- `result.meta.changes === 0` used to detect "not found" on `UPDATE`/`DELETE` (e.g., `packages/api/src/services/billing-service.ts:60-62`)
- IDs generated via `crypto.randomUUID()` (in `packages/api/src/lib/id-utils.ts`)
- D1 row IDs use plain UUIDs; transaction IDs for SePay use `topup_<16 hex chars>` (e.g., `packages/api/src/services/sepay-service.ts:17`)
## Hono Conventions
- Each route file exports `createXxxRoutes()` returning a `new Hono<{ Bindings: Bindings }>()` instance
- Bindings are duplicated as a local `type Bindings` in each file rather than imported from a shared types module
- Middleware applied via `router.use("*", handler)` before route definitions
- API key auth and rate limit are inlined per route file with a thin wrapper (e.g., `packages/api/src/routes/openai-routes.ts:23-30`):
- This pattern is repeated in `openai-routes.ts` and `anthropic-routes.ts` rather than abstracting the chain
- Typed via `declare module "hono" { interface ContextVariableMap { user: AuthUser } }` (e.g., `packages/api/src/middleware/auth-middleware.ts:11-15`)
## React/JSX Conventions (Dashboard)
- `export default function ComponentName()` (not arrow)
- Inline `style={{ ... }}` for layout/colors using CSS custom properties from `tokens.css` (e.g., `var(--color-primary)`, `var(--space-md)`)
- No CSS modules, no Tailwind, no styled-components
- CSS variables defined in `packages/dashboard/src/styles/tokens.css` (Carbon Design System token names)
- Local `useState` only; no Redux, Zustand, or Context providers
- `useEffect` with empty dep array for initial data load
- Token read from `document.cookie` directly (no auth context)
- All API calls go through `src/lib/api-client.ts` `request<T>()` function
- Custom `ApiError` class thrown on non-2xx (status + message)
- 401 responses trigger `window.location.href = "/login"` automatically
## Where to Add New Code
- Create `packages/api/src/services/<name>-service.ts`
- Define `<Name>Service` interface, then `export function create<Name>Service(deps): <Name>Service { ... }`
- Add test file at `packages/api/src/services/__tests__/<name>-service.test.ts`
- Create `packages/api/src/routes/<name>-routes.ts`
- Export `create<Name>Routes()` returning Hono router
- Mount in `packages/api/src/index.ts` via `app.route("/api/<name>", create<Name>Routes())`
- Create `packages/api/src/middleware/<name>-middleware.ts`
- Export `create<Name>Middleware(deps)` returning the Hono handler closure
- Create `packages/dashboard/src/pages/dashboard/<name>.astro`
- Wrap content in `<DashboardLayout title="...">`
- For interactive widgets, create a separate `src/components/<name>.tsx` with `client:load` directive
- Create `packages/dashboard/src/components/<name>.tsx`
- Use `export default function`, inline styles via `var(--...)` tokens
- Add new API methods to `packages/dashboard/src/lib/api-client.ts` `api` object
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
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
- **Service-factory pattern.** Every service is a function `createXService(deps): XService` that closes over dependencies (DB, R2, AI, etc.) and returns an object of methods. No classes, no DI container — dependencies are passed explicitly per request from the route handler. Stateless across requests, no module-level mutables.
- **One Hono app, many sub-routers.** `index.ts` calls `app.route("/prefix", createXxxRoutes())` for each domain. Each sub-router is built inside a `createXxxRoutes()` factory that owns its middleware and handlers.
- **Two auth schemes on two surfaces.** API gateway routes use `Bearer sk-…` (api-key-middleware → rate-limit). Dashboard routes use `Bearer <jwt>` (auth-middleware → optional admin-middleware). Webhooks use `Authorization: Apikey <secret>`.
- **Worker as static asset host.** The dashboard is `astro build` (static SSG); the API Worker serves it via `assets` binding in `wrangler.toml` with `run_worker_first = true`. The catch-all `app.all("*", c.env.ASSETS.fetch)` returns the SPA shell.
- **D1 as the only SQL store; everything else is object/blob storage.** D1 holds users, API keys, usage logs, OTP, topup records. R2 holds RAG document chunks and payment-proof uploads. Vectorize holds the embedding index. Workers AI provides both embeddings (`@cf/bge-base-en-v1.5`, 768-dim) and inference via AI Gateway.
- **Streaming passthrough.** Gateway responses can be SSE; usage logging and balance deduction for streamed calls happen inside `c.executionCtx.waitUntil(...)` so the client stream is not blocked.
- **Astro islands.** The dashboard renders 95% HTML at build time; only four components are React islands with `client:load` (otp-form, usage-chart, admin-user-table, admin-transaction-table). No client-side routing — every page is a separate `.astro` file.
## Layers
- Purpose: Translate Hono `Context` into domain operations; bind middleware; shape JSON responses.
- Location: `packages/api/src/routes/`
- Contains: 12 route files. Each is a `createXxxRoutes()` factory returning a `Hono` sub-router.
- Depends on: `middleware/`, `services/`, `types/`, `lib/`, `config/`.
- Used by: `index.ts`.
- Purpose: Authenticate, rate-limit, authorize.
- Location: `packages/api/src/middleware/`
- Contains: 4 files. Each exports a `createXxxMiddleware(deps?)()` factory returning a Hono middleware function.
- Depends on: `services/jwt-service`, D1 directly (for api-key lookup + user status).
- Used by: `routes/`.
- Purpose: Pure business logic. No HTTP awareness. Take dependencies as factory args.
- Location: `packages/api/src/services/`
- Contains: 16 service files + `__tests__/` (4 test files).
- Depends on: D1 SQL strings, Cloudflare binding types (`Ai`, `R2Bucket`, `VectorizeIndex`), `lib/`, `config/`, `types/`.
- Used by: `routes/`, `middleware/`.
- Purpose: Tiny helpers that don't warrant a service.
- Location: `packages/api/src/lib/`
- Contains: 1 file (`id-utils.ts`).
- Depends on: Web Crypto API.
- Used by: `services/`, `routes/`.
- Purpose: Compile-time constants (pricing table, admin email).
- Location: `packages/api/src/config/`
- Contains: 2 files.
- Depends on: nothing.
- Used by: `services/`, `routes/`.
- Purpose: Shared request/response shapes.
- Location: `packages/api/src/types/`
- Contains: 3 files (`openai-types.ts`, `anthropic-types.ts`, `rag-types.ts`).
- Depends on: nothing.
- Used by: `routes/`, `services/`.
- Purpose: SQL DDL. `schema.sql` mirrors migrations for fresh setups.
- Location: `packages/api/src/db/`
- Contains: `schema.sql` + `migrations/001-initial.sql`, `002-admin-role.sql`, `003-user-status-and-proof.sql`.
- Depends on: nothing in code (applied out-of-band by `wrangler d1 migrations apply`).
- Used by: deploy script, all SQL string literals throughout `services/` and `routes/`.
- Purpose: Server-rendered (at build time, static) HTML entry points.
- Location: `packages/dashboard/src/pages/`
- Contains: 1 root page (`login.astro`) + `dashboard/{usage,billing,api-keys,profile}.astro` + `dashboard/admin/{users,transactions}.astro`.
- Depends on: `layouts/`, `components/`.
- Used by: Astro build → `packages/dashboard/dist/` → served by Worker via `ASSETS` binding.
- Purpose: HTML shell, sidebar, design tokens import.
- Location: `packages/dashboard/src/layouts/`
- Contains: `auth-layout.astro` (centered card) and `dashboard-layout.astro` (sidebar nav + role-based admin link + logout).
- Depends on: `styles/tokens.css`.
- Used by: every `pages/*.astro`.
- Purpose: Interactive client-side UI that the static HTML shell can't do alone.
- Location: `packages/dashboard/src/components/`
- Contains: 4 `.tsx` files (otp-form, usage-chart, admin-user-table, admin-transaction-table). All use `client:load` directive in the parent `.astro`.
- Depends on: `lib/api-client.ts`.
- Used by: `pages/`.
- Purpose: Centralize fetch + token-cookie handling + 401 redirect.
- Location: `packages/dashboard/src/lib/api-client.ts`
- Contains: 1 file. ~130 lines of typed `request<T>()` + `api` namespace.
- Depends on: `import.meta.env.PUBLIC_API_URL` (Astro env), `document.cookie`.
- Used by: every React island; some `.astro` files still do raw `fetch` with `getToken()` (see CONCERNS).
- Purpose: Single source of truth for colors, spacing, typography.
- Location: `packages/dashboard/src/styles/tokens.css`
- Contains: 1 file. IBM Carbon-inspired CSS custom properties.
- Depends on: nothing.
- Used by: every `.astro` and `.tsx` via direct `var(--...)` references in inline styles.
## Data Flow
### Primary Request Path — OpenAI-compatible gateway call
### Dashboard page load
### OTP login
### SePay webhook (bank-transfer topup)
- **No client-side state library** on the dashboard. Each `.astro` page re-fetches on load; React islands hold local `useState` only.
- **No server-side state cache.** D1 is the only source of truth; every request hits D1.
- **In-process rate-limit state** is a module-level `Map` in `rate-limit-middleware.ts:12` — single-worker only, lost on redeploy. See CONCERNS.
## Key Abstractions
- Purpose: Construct a domain object with its dependencies bound.
- Examples: `createBillingService()`, `createOtpService(db)`, `createRAGService({ai, r2, vectorize})`, `createGatewayService({gatewayId})`.
- Pattern: `export function createXService(deps): XService { … return { method1, method2, … }; }`
- Purpose: Strongly-typed `c.env` per route group.
- Examples: Every route file declares its own `type Bindings = { DB: D1Database; R2: R2Bucket; … }` local to the file. Hono is parameterized as `new Hono<{ Bindings: Bindings }>()`.
- Pattern: Subset of the root `Bindings` in `index.ts` (the root type also includes `JWT_SECRET`, `ENVIRONMENT`, `SEPAY_*`, `EMAILIT_API_KEY`, `ASSETS`).
- Purpose: Type contract for each factory.
- Examples: `OtpService`, `JwtService`, `BillingService`, `EmailService`, `RAGService`, `GatewayService`, `R2StorageService`, `VectorizeService`, `EmbeddingService`, `ContextBuilderService`, `UsageService`, `SepayService`, `IndexerService`, `ProofValidationResult`.
- Pattern: `export interface XService { methodA(...): Promise<…>; methodB(...): …; }`.
- Purpose: Type the per-request auth state.
- Examples: `api-key-middleware.ts:3` adds `userId`, `apiKeyId`, `apiKeyName`; `auth-middleware.ts:11` adds `user: AuthUser`.
- Pattern: `declare module "hono" { interface ContextVariableMap { … } }`.
- Purpose: Reuse the same AI Gateway + RAG pipeline for both API shapes.
- Examples: `anthropic-routes.ts:71–84` collapses `messages[].content[]` blocks to strings, prepends `system` as a `system` message, then forwards the same OpenAI-shaped body to the gateway.
- Pattern: Anthropic request → OpenAI-shaped internal type → gateway fetch → Anthropic-shaped response.
## Entry Points
- Triggers: Every HTTP request to the Worker.
- Responsibilities: Apply CORS + logger globally, mount 9 sub-routers under their prefixes, expose `/health`, redirect `/` to `/login`, fall through unmatched paths to `ASSETS.fetch` (the dashboard shell). Exports `default app` for Wrangler.
- Triggers: Browser navigates to `/login`.
- Responsibilities: Mount `<AuthLayout>` + `<OtpForm client:load />`. (The other "entry" is the Worker catch-all serving the built static HTML.)
- Triggers: Admin POSTs JSON `{ prefix?: string }`.
- Responsibilities: Spawn index rebuild via `c.executionCtx.waitUntil(indexer.runIndex(prefix))`; return 202 immediately. Indexing can take a while.
- Triggers: Invoked from the admin reindex route.
- Responsibilities: List R2 objects (optionally by prefix), chunk text (500-token chunks, 50-token overlap), embed via Workers AI in batches of 10, upsert to Vectorize with metadata `{r2_key, chunk_index, preview}`. Used to build the RAG corpus; not invoked per-request.
## Architectural Constraints
- **Threading:** Single-threaded event loop per Worker isolate. No worker threads. `c.executionCtx.waitUntil()` is used to fire-and-forget async work after the response has been sent (streaming usage logging, indexing).
- **Global state:**
- **Circular imports:** None observed. Service files import their helpers (`lib/`, `config/`, `types/`) but never siblings. Routes import services, never the other way around.
- **D1-only SQL.** No ORM. Every query is a hand-written `db.prepare("…").bind(…).first/all/run()`. No transactions are opened; multi-step writes (e.g., add credit + mark confirmed) are separate calls.
- **Two auth schemes, two token stores.** `api_keys` table holds SHA-256 hashes of `sk-…` keys; `users` table drives JWTs (HS256 with `JWT_SECRET`). Never mixed — `auth-middleware` always reads `users`, `api-key-middleware` always reads `api_keys`.
- **No server-side streaming state for the worker host.** The dashboard uses `output: "static"` (`packages/dashboard/astro.config.mjs:5`) — no SSR adapter. All data fetching happens client-side after hydration.
## Anti-Patterns
### Inline raw `fetch` in `.astro` pages
### Hand-written SQL strings scattered across `services/` and `routes/`
### Module-level `Map` for rate limiting
### Hard-coded `ADMIN_EMAIL`
## Error Handling
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
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
