# Coding Conventions

**Analysis Date:** 2026-06-04

## Naming Patterns

**Files:**
- Services: `kebab-case-service.ts` (e.g., `billing-service.ts`, `jwt-service.ts`, `email-service.ts`) — `packages/api/src/services/`
- Routes: `kebab-case-routes.ts` (e.g., `auth-routes.ts`, `openai-routes.ts`, `billing-proof-routes.ts`) — `packages/api/src/routes/`
- Middleware: `kebab-case-middleware.ts` (e.g., `auth-middleware.ts`, `api-key-middleware.ts`, `rate-limit-middleware.ts`) — `packages/api/src/middleware/`
- Tests: `<name>.test.ts` co-located under `src/services/__tests__/` (e.g., `otp-service.test.ts`)
- Dashboard components: `kebab-case.tsx` (e.g., `admin-transaction-table.tsx`, `otp-form.tsx`)
- Dashboard pages: `kebab-case.astro` (e.g., `usage.astro`, `api-keys.astro`)
- Layouts: `kebab-case-layout.astro` (e.g., `dashboard-layout.astro`)
- Config: `kebab-case-config.ts` (e.g., `pricing-config.ts`, `admin-config.ts`)

**Functions:**
- Factory functions: `createXxxService()` (e.g., `createBillingService()`, `createJwtService()`, `createEmbeddingService(ai)`) — return an interface with method bindings
- Middleware factories: `createXxxMiddleware()` returning `(c: Context, next: Next) => Promise<...>`
- Route factories: `createXxxRoutes()` returning a Hono router instance
- Helper utilities: camelCase verb phrases (e.g., `vndToUsdCents`, `extractEmbeddings`, `estimateMessagesTokens`, `validateProofFile`, `getProofR2Key`, `generateCode`, `hashKey`, `generateApiKey`, `getKeyPrefix`)
- Top-level `calculateCost(model, inputTokens, outputTokens)` for pure functions (see `packages/api/src/services/token-counter-service.ts`)

**Variables & Constants:**
- SCREAMING_SNAKE_CASE for module-level constants (e.g., `TOKEN_EXPIRY_HOURS`, `ALG_HEADER`, `MAX_ATTEMPTS`, `VND_TO_USD_CENTS`, `CHUNK_SIZE`, `OTP_CODE_LENGTH`)
- camelCase for local variables, parameters, function-scoped bindings
- Underscore prefix for intentionally unused params: `_transactionId` (e.g., `addCredit` in `packages/api/src/services/billing-service.ts:69`)

**Types & Interfaces:**
- `PascalCase` for interfaces, types, and type aliases (e.g., `BillingService`, `JwtPayload`, `OtpEntry`, `AuthUser`, `Bindings`, `SepayWebhookPayload`)
- Service interfaces: noun phrase, no `I` prefix (e.g., `BillingService`, `OtpService`, `JwtService`, `EmbeddingService`, `GatewayService`)
- Configuration interfaces: `XxxConfig` or `XxxDeps` (e.g., `SepayConfig`, `GatewayConfig`, `RAGServiceDeps`, `ApiKeyMiddlewareDeps`)

## Code Style

**Formatting:**
- No Prettier, no ESLint, no Biome config files detected (`.prettierrc*`, `eslint.config.*`, `biome.json` are all absent)
- Both `packages/api` and `packages/dashboard` define `lint: "echo 'lint ok'"` — lint is currently a no-op stub
- `tsconfig.base.json` enables: `strict: true`, `skipLibCheck: true`, `esModuleInterop: true`, `isolatedModules: true`, `forceConsistentCasingInFileNames: true`, `target: "ES2022"`, `module: "ES2022"`, `moduleResolution: "bundler"`
- Observed 2-space indentation throughout
- Double quotes for strings (e.g., `"gpt-4o"`, `"auth-middleware"`)
- Trailing commas used in multi-line parameter lists and object literals
- Semicolons required at end of statements

**Naming inside files:**
- File-local helper functions are declared before the factory `createXxx` function and are not exported
- TypeScript types imported with `import type { ... }` when used only as types (e.g., `import type { ChunkContent } from "../types/rag-types"`)

**Type Annotations:**
- Explicit return type annotations on factory functions and inner closure functions (e.g., `Promise<number>`, `Promise<void>`)
- `as unknown as D1Database` casting pattern is used in tests to satisfy the `D1Database` global type
- Bindings are defined per file as a local `type Bindings = { ... }` rather than a shared type (see `packages/api/src/routes/auth-routes.ts:8`, `packages/api/src/index.ts:14`)
- `c.get("userId") as string` and `c.get("apiKeyId") as string` are used in routes (e.g., `packages/api/src/routes/openai-routes.ts:39-40`)

## Import Organization

**Order (observed convention):**
1. External library imports first (e.g., `import { Hono } from "hono"`, `import type { Context, Next } from "hono"`)
2. Type-only imports from external libraries (e.g., `import type { ContentfulStatusCode } from "hono/utils/http-status"`)
3. Internal relative imports, alphabetical by source path (e.g., `../config/...`, `../lib/...`, `../middleware/...`, `../services/...`, `../types/...`)

**Path Aliases:**
- No path aliases (e.g., `@/` or `~`) are configured. All imports use relative paths (`../services/...`, `./sub-routes/...`).
- The `tsconfig.base.json` does not define `paths`.

**Path Style:**
- Always use `"./..."` for same-directory or `"./routes/admin-routes"` (omitting `.ts` extension; TypeScript handles resolution with `allowImportingTsExtensions`)
- `import.meta.env.PUBLIC_API_URL` is the only observed build-time env access (Astro convention; `packages/dashboard/src/lib/api-client.ts:1`)

**Barrel Files:**
- Not used. Each module exports named symbols directly; no `index.ts` re-exports within `services/`, `routes/`, `middleware/`.

## Error Handling

**Strategy:** Throw `Error` with a short UPPER_SNAKE_CASE code or human-readable message; let the route handler catch and translate to HTTP status.

**Patterns observed:**

1. **Services throw plain `Error` with code strings or messages** (e.g., `packages/api/src/services/otp-service.ts:46`):
   ```ts
   throw new Error("RATE_LIMIT_EXCEEDED");
   throw new Error("Insufficient balance"); // billing-service.ts:61
   throw new Error("EMAIL_SEND_FAILED");     // email-service.ts:41
   ```

2. **Routes catch and map to HTTP status codes** (e.g., `packages/api/src/routes/auth-routes.ts:34-40`):
   ```ts
   try { ... }
   catch (err) {
     if (err instanceof Error && err.message === "RATE_LIMIT_EXCEEDED") {
       return c.json({ error: "Too many OTP requests. Try again later." }, 429);
     }
     console.error("OTP send error:", err);
     return c.json({ error: "Failed to send OTP" }, 500);
   }
   ```

3. **Default 500 fallback at top of route** (e.g., `packages/api/src/routes/openai-routes.ts:113-119`):
   ```ts
   catch (err) {
     console.error("OpenAI route error:", err);
     return c.json(
       { error: err instanceof Error ? err.message : "Internal server error" },
       500
     );
   }
   ```

4. **Silent fail on non-critical background tasks** — `.catch(() => {})` is used for fire-and-forget usage logging and balance deduction inside `c.executionCtx.waitUntil(...)` (see `packages/api/src/routes/openai-routes.ts:82-83`):
   ```ts
   .catch((err) => console.error("Failed to log streaming usage:", err));
   await billing.deductBalance(c.env.DB, userId, cost).catch(() => {});
   ```

5. **Webhooks always return 200** to prevent provider retry storms (e.g., `packages/api/src/routes/webhook-routes.ts:38-40, 87-90`):
   ```ts
   if (!payload.id || !payload.transferAmount || payload.transferType !== "in") {
     return c.json({ success: true }, 200);
   }
   ```

6. **JWT verify returns `null` on any failure** rather than throwing — caller decides. (See `packages/api/src/services/jwt-service.ts:67-86`.)

7. **RAG failures degrade gracefully** — try/catch returns the original messages with `contextUsed: false` (see `packages/api/src/services/rag-service.ts:128-131`):
   ```ts
   } catch (err) {
     console.error("RAG enrichment failed, proceeding without context:", err);
     return { messages, contextUsed: false };
   }
   ```

## Logging

**Framework:** Plain `console.log` / `console.error` — no structured logger (pino, winston, etc.) detected.

**Patterns:**
- `console.log` is reserved for the email dev fallback when `emailitApiKey` is missing (e.g., `packages/api/src/services/email-service.ts:19, 50`)
- `console.error` is used in route catch blocks, service failure paths, and webhook mismatches (16 occurrences across `packages/api/src/`)
- Tag-style prefixes: `"[EMAIL] To: ..."` for dev-only email fallback
- No log levels (info/warn/debug) — only `log` and `error`
- No JSON structured logs

## Comments

**When to Comment:**
- Block comments for module-level constants where units/format matter (e.g., `packages/api/src/services/billing-service.ts:4` `// Exchange rate: 1 USD ≈ 25,500 VND`)
- Inline comments to mark processing steps in long functions (e.g., `packages/api/src/services/indexer-service.ts:29` `// Keep overlap words`, `packages/api/src/services/rag-service.ts:75` `// Embed query`)
- Block comments for middleware behavior (e.g., `packages/api/src/middleware/rate-limit-middleware.ts:11` `// In-memory sliding window counter (adequate for single-worker, resets on redeploy)`)
- JSDoc only used on the Admin middleware file (`packages/api/src/middleware/admin-middleware.ts:3-7`)

**JSDoc/TSDoc:**
- Sparse; only one formal JSDoc block observed (admin-middleware.ts)
- Most code relies on function names and types rather than JSDoc

## Function Design

**Size:**
- Most functions are < 50 lines. Route handlers are the largest, typically 40–100 lines.
- Helper functions in services are short and focused (e.g., `hmacSha256`, `base64UrlEncode`, `extractEmbeddings`)

**Parameters:**
- Object destructuring for > 2 parameters in service method signatures (e.g., `packages/api/src/services/usage-service.ts:5-13` `logUsage(db, params: { userId, apiKeyId, model, inputTokens, outputTokens, costCents })`)
- Dependency objects (deps pattern) used for services with multiple external clients (e.g., `packages/api/src/services/rag-service.ts:8-12` `RAGServiceDeps = { ai, r2, vectorize }`)

**Return Values:**
- Async functions return `Promise<T>`; never throw non-`Error` values
- Status codes embedded in Hono responses via `c.json(payload, status)`
- Validation helpers return `{ valid: boolean; error?: string }` discriminated unions (e.g., `packages/api/src/services/proof-upload-service.ts:4-7`)

**Closures inside factory pattern:**
- Inner arrow functions are assigned to `const` then returned as object literal (e.g., `packages/api/src/services/billing-service.ts:28-92`):
  ```ts
  export function createBillingService(): BillingService {
    const calculateCost = (...) => { ... };
    const getBalance = async (...) => { ... };
    return { calculateCost, getBalance, ... };
  }
  ```

## Module Design

**Exports:**
- One factory function (`createXxx`) per file, plus an interface describing the returned object
- Helper utilities may also be exported when reusable across modules (e.g., `generateApiKey`, `hashKey`, `getKeyPrefix` from `packages/api/src/middleware/api-key-middleware.ts:76`)

**Barrel Files:**
- Not used. No `index.ts` re-exports in `services/`, `routes/`, `middleware/`, or `types/`.

**Default vs Named Exports:**
- Always named exports — no `export default` for service or route modules
- React components in the dashboard use `export default function ComponentName()` (e.g., `packages/dashboard/src/components/otp-form.tsx:4`)

## D1 / SQL Conventions

**Query style:**
- All SQL is inline as template strings passed to `db.prepare(...)`
- `bind(...)` for parameter substitution; never string-concatenate user input into SQL
- `.first<T>()` for single-row selects with explicit generic type; `.all<T>()` for multi-row
- `result.meta.changes === 0` used to detect "not found" on `UPDATE`/`DELETE` (e.g., `packages/api/src/services/billing-service.ts:60-62`)

**Transaction ID format:**
- IDs generated via `crypto.randomUUID()` (in `packages/api/src/lib/id-utils.ts`)
- D1 row IDs use plain UUIDs; transaction IDs for SePay use `topup_<16 hex chars>` (e.g., `packages/api/src/services/sepay-service.ts:17`)

## Hono Conventions

**Route module pattern:**
- Each route file exports `createXxxRoutes()` returning a `new Hono<{ Bindings: Bindings }>()` instance
- Bindings are duplicated as a local `type Bindings` in each file rather than imported from a shared types module
- Middleware applied via `router.use("*", handler)` before route definitions

**Middleware composition:**
- API key auth and rate limit are inlined per route file with a thin wrapper (e.g., `packages/api/src/routes/openai-routes.ts:23-30`):
  ```ts
  router.use("*", (c, next) => {
    const mw = createApiKeyMiddleware({ db: c.env.DB });
    return mw(c, next);
  });
  ```
- This pattern is repeated in `openai-routes.ts` and `anthropic-routes.ts` rather than abstracting the chain

**Context variables:**
- Typed via `declare module "hono" { interface ContextVariableMap { user: AuthUser } }` (e.g., `packages/api/src/middleware/auth-middleware.ts:11-15`)

## React/JSX Conventions (Dashboard)

**Component style:**
- `export default function ComponentName()` (not arrow)
- Inline `style={{ ... }}` for layout/colors using CSS custom properties from `tokens.css` (e.g., `var(--color-primary)`, `var(--space-md)`)
- No CSS modules, no Tailwind, no styled-components
- CSS variables defined in `packages/dashboard/src/styles/tokens.css` (Carbon Design System token names)

**State management:**
- Local `useState` only; no Redux, Zustand, or Context providers
- `useEffect` with empty dep array for initial data load
- Token read from `document.cookie` directly (no auth context)

**API access:**
- All API calls go through `src/lib/api-client.ts` `request<T>()` function
- Custom `ApiError` class thrown on non-2xx (status + message)
- 401 responses trigger `window.location.href = "/login"` automatically

## Where to Add New Code

**New Service (API):**
- Create `packages/api/src/services/<name>-service.ts`
- Define `<Name>Service` interface, then `export function create<Name>Service(deps): <Name>Service { ... }`
- Add test file at `packages/api/src/services/__tests__/<name>-service.test.ts`

**New Route Group:**
- Create `packages/api/src/routes/<name>-routes.ts`
- Export `create<Name>Routes()` returning Hono router
- Mount in `packages/api/src/index.ts` via `app.route("/api/<name>", create<Name>Routes())`

**New Middleware:**
- Create `packages/api/src/middleware/<name>-middleware.ts`
- Export `create<Name>Middleware(deps)` returning the Hono handler closure

**New Dashboard Page:**
- Create `packages/dashboard/src/pages/dashboard/<name>.astro`
- Wrap content in `<DashboardLayout title="...">`
- For interactive widgets, create a separate `src/components/<name>.tsx` with `client:load` directive

**New React Component:**
- Create `packages/dashboard/src/components/<name>.tsx`
- Use `export default function`, inline styles via `var(--...)` tokens
- Add new API methods to `packages/dashboard/src/lib/api-client.ts` `api` object
