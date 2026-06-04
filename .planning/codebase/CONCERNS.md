# Codebase Concerns

**Analysis Date:** 2026-06-04

## Security Considerations

### SePay webhook "signature" is not HMAC (CRITICAL)
- **Risk:** Anyone who learns `SEPAY_WEBHOOK_SECRET` (or who can guess a weak value) can forge a webhook that the system accepts as legitimate.
- **Files:** `packages/api/src/services/sepay-service.ts:24-30`
- **Current state:** `verifyWebhookSignature` does a plain string equality: `return signature === config.webhookSecret;`. The journal `docs/journals/260604-1314-cloudflare-ai-gateway-full-implementation.md` claims "Added HMAC-SHA256 verification to /api/billing/webhook", but the shipped code is *not* HMAC — it's a static secret sent in the `Authorization` header. The secret value is the same as the "signature" the client sends.
- **Recommendations:** Compute `HMAC-SHA256(secret, rawBody)` server-side, compare with `crypto.timingSafeEqual` to prevent timing attacks. Send signature in a header separate from the secret. Reject when the secret env var is missing (fail-closed, see next item).

### Webhook auth fails OPEN if `SEPAY_WEBHOOK_SECRET` is unset
- **Risk:** Misconfiguration in dev or prod drops auth entirely; anyone can POST to `/api/webhooks/sepay` and credit accounts.
- **Files:** `packages/api/src/routes/webhook-routes.ts:30-34`
- **Current state:** `if (expectedKey && apiKey !== \`Apikey ${expectedKey}\`) { return ... 401; }` — the `expectedKey &&` short-circuits, so when the env var is missing the check is skipped and the request proceeds.
- **Recommendations:** Remove the `expectedKey &&` guard. If the secret is missing, return 500/503. The same handler also catches all errors and returns `{ success: true }:200` (line 87-90), which masks auth failures and complicates detection.

### Webhook credits arbitrary amounts (no minimum/match)
- **Risk:** User requests a $1 topup, but SePay reports a different amount (or attacker forges payload). The system credits whatever SePay says, not the registered amount. `pending.amount_cents` from D1 is read but never used in the credit calculation.
- **Files:** `packages/api/src/routes/webhook-routes.ts:62-77`
- **Current state:** `const usdCents = vndToUsdCents(payload.transferAmount);` then `billing.addCredit(c.env.DB, pending.user_id, usdCents, sepayId);` — credits the SePay-reported amount, not the registered pending amount. A small overpayment or a coerced `transferAmount` is credited in full.
- **Recommendations:** Compare `payload.transferAmount` to `pending.amount_cents` (with FX tolerance band) and reject mismatches. Use the registered amount as the source of truth.

### Stored XSS via API key name in admin table
- **Risk:** A user can name their API key with HTML/JS (e.g., `'><script>...`). The dashboard renders the name into a button's `onclick` attribute with no escaping. Click triggers arbitrary JS in the admin's session.
- **Files:** `packages/dashboard/src/pages/dashboard/api-keys.astro:45-57` and `packages/dashboard/src/components/admin-transaction-table.tsx` style usage in `admin-user-table.tsx`
- **Current state:** `<button onclick="revokeKey('${k.id}', '${k.name}')">` — single-quote interpolation. `k.name` is also rendered as cell text via template literal; React's JSX auto-escapes (so admin-user-table is safer), but the inline `onclick` handler in api-keys.astro is plain HTML, not JSX.
- **Recommendations:** Move the revoke handler to a data-attribute + addEventListener pattern. Sanitize `k.name` in api-keys.astro (escape quotes, strip control chars) before interpolation.

### OTP code generated with `Math.random()`
- **Risk:** `Math.random()` is not cryptographically secure. With 6 digits and rate-limited to 3 OTPs / 10 min / email, predictability doesn't enable trivial brute force, but for high-value targets (admin email) the predictability is real and the rate limit doesn't reset the per-code entropy.
- **Files:** `packages/api/src/services/otp-service.ts:27-32`
- **Current state:** `Math.floor(Math.random() * 10).toString()` for each of 6 digits.
- **Recommendations:** Use `crypto.getRandomValues(new Uint8Array(6))` and convert each byte to `value % 10`. Reuses the same Web Crypto API already in use for key generation.

### OTP log to console in dev mode
- **Risk:** OTPs leak into logs. Cloudflare Workers `console.log` output is captured by Logpush; if any log destination isn't fully access-controlled, OTPs are exfiltrable.
- **Files:** `packages/api/src/services/email-service.ts:19`
- **Current state:** `console.log(\`[EMAIL] To: ${email}, OTP: ${code}\`);` when `EMAILIT_API_KEY` is unset.
- **Recommendations:** In production (`ENVIRONMENT === "production"`), throw if `EMAILIT_API_KEY` is missing. Don't log the code, ever — log a redacted hash or the email + timestamp.

### JWT stored in client-readable cookie (not httpOnly)
- **Risk:** XSS in the dashboard reads `document.cookie` and exfiltrates the JWT. Astro static output means the cookie is set client-side via JS, so httpOnly is not set.
- **Files:** `packages/dashboard/src/components/otp-form.tsx:32`
- **Current state:** `document.cookie = \`token=${result.token}; path=/; max-age=3600; SameSite=Strict; Secure\`;`
- **Recommendations:** Have the `/api/auth/otp/verify` endpoint set the cookie via `Set-Cookie` (httpOnly, secure, sameSite=Strict) in the response. Client never sees the JWT.
- **Secondary issue:** Dashboard JS reads JWT payload client-side to decide admin nav (`dashboard-layout.astro:100-114`). Decoding base64 in JS requires the token to be readable. With httpOnly cookie, the auth check would need to call a `/api/auth/me` endpoint instead.

### CORS allowlist is dev-only — production blocked
- **Risk:** Production dashboard at `https://butchi-api.ngoclamlai.workers.dev` (or custom domain) cannot call `/api/*` from a different origin. Browser CORS preflight fails.
- **Files:** `packages/api/src/index.ts:33-36`
- **Current state:** `origin: ["http://localhost:4321"]` — single hardcoded dev origin.
- **Recommendations:** Read allowed origins from env (e.g., `ALLOWED_ORIGINS` comma-separated). In production, set to the deployed dashboard URL. Astro's static build outputs the dashboard from the same Worker (`run_worker_first = true`), so a same-origin fetch won't trigger CORS at all if the dashboard uses relative URLs — verify that, then CORS can be removed or restricted to `null` for SSR.

### Rate limit middleware is in-memory
- **Risk:** A single Worker runs on many isolates across Cloudflare's edge. The `Map<string, Counter>` in `rate-limit-middleware.ts` is per-isolate, so an attacker can scale past 60 req/min by hitting different isolates. Also, the in-memory map has no eviction — long-running isolates accumulate entries (memory leak in production).
- **Files:** `packages/api/src/middleware/rate-limit-middleware.ts:12`
- **Current state:** `const counters = new Map<string, { count: number; resetAt: number }>();` — module-level, isolated to one Worker instance.
- **Recommendations:** Move counters to Durable Objects (single-writer per key) or Workers KV (sliding window via sorted set). Plan `phase-03-api-gateway-core.md` explicitly listed "Sliding window counter in D1 hoặc Workers KV" but neither was implemented.

### In-memory rate limit has no `Retry-After` HTTP header
- **Risk:** Standard HTTP clients (and the AI Gateway) honor `Retry-After` header; we only set it in the JSON body. Reduces observability and compliance with RFC 9110.
- **Files:** `packages/api/src/middleware/rate-limit-middleware.ts:29-35`
- **Current state:** Returns JSON `{ error, retryAfter }` with status 429, but no header.
- **Recommendations:** `c.header("Retry-After", String(Math.ceil(...)))` before returning.

### Admin email hardcoded in source
- **Risk:** Changing the admin email requires a code change + redeploy. If the source is in version control, the original admin's email is permanently visible in git history.
- **Files:** `packages/api/src/config/admin-config.ts:1`
- **Current state:** `export const ADMIN_EMAIL = "ngoclam.lai@gmail.com";`
- **Recommendations:** Move to env var (e.g., `ADMIN_EMAIL`), with the hardcoded value as a fallback only for local dev. Add to `.dev.vars.example`.

## Tech Debt

### Two sources of truth for DB schema
- **Issue:** `packages/api/src/db/schema.sql` (consolidated, 7 tables) and `packages/api/migrations/` (3 incremental files) describe the same database. The schema.sql has columns that only exist after migrations 002/003 apply (`role`, `status`, `proof_url`).
- **Files:** `packages/api/src/db/schema.sql`, `packages/api/migrations/001-initial.sql`, `packages/api/migrations/002-admin-role.sql`, `packages/api/migrations/003-user-status-and-proof.sql`
- **Impact:** New developers can't tell which file is "real" (D1 uses the migrations directory; schema.sql is documentation). Risk of drift on next schema change.
- **Fix approach:** Make schema.sql auto-generated from migrations, or delete it and rely on the migrations directory. Add a `pnpm db:schema` script that concatenates migrations for reference.

### Placeholder migration `0002_test-name.sql`
- **Issue:** `packages/api/migrations/0002_test-name.sql` contains only the Wrangler migration-number comment and no DDL. Looks like a test commit that wasn't cleaned up.
- **Files:** `packages/api/migrations/0002_test-name.sql`
- **Impact:** Confusing for future migrations (file is 53 bytes of comment). Will execute harmlessly but is noise.
- **Fix approach:** Delete the file (Wrangler tracks applied migrations in D1; the file is not needed in source if already applied).

### `addCredit` accepts a transaction ID but discards it
- **Issue:** The signature `addCredit(db, userId, amountCents, transactionId)` takes a transaction ID, but the implementation renames it to `_transactionId` and never inserts it. The audit/idempotency claim is broken.
- **Files:** `packages/api/src/services/billing-service.ts:65-75`
- **Impact:** SePay webhook retry can call `addCredit` twice (the `topup_records.sepay_transaction_id` UNIQUE check protects the topup row, but the user balance increment is not protected). A retry of `addCredit` between the existence check and the credit call will double-credit.
- **Fix approach:** Either (a) accept the race in a single D1 statement by switching the topup lookup to `INSERT ... ON CONFLICT DO NOTHING RETURNING`, or (b) move the user balance update into a single atomic statement guarded by the topup state transition.

### Webhook handler has a TOCTOU race
- **Issue:** Between the "no confirmed record" check (line 44-53) and the credit+update (line 76-84), a concurrent webhook for the same `sepayId` could pass the check and both proceed.
- **Files:** `packages/api/src/routes/webhook-routes.ts:42-84`
- **Impact:** Double-credit on webhook retry or duplicate delivery.
- **Fix approach:** Use a single `UPDATE topup_records SET status='confirmed' WHERE id=? AND status='pending' RETURNING ...` and only call `addCredit` if `meta.changes > 0`.

### ID generation is inconsistent
- **Issue:** `packages/api/src/lib/id-utils.ts:generateId()` returns `crypto.randomUUID()`, but other places use `crypto.randomUUID()` directly (`billing-routes.ts:61`), or a sliced hex (`sepay-service.ts:17`).
- **Files:** `packages/api/src/lib/id-utils.ts:1`, `packages/api/src/routes/billing-routes.ts:61`, `packages/api/src/services/sepay-service.ts:17`
- **Impact:** Inconsistent ID shapes complicate debugging and audits. Some IDs are 36 chars (UUID), some are 32 (UUID without hyphens), some are 16 (truncated).
- **Fix approach:** Standardize on `generateId()` everywhere; remove direct `crypto.randomUUID()` calls.

### Stale plan statuses
- **Issue:** `plans/260604-1153-cloudflare-ai-gateway-api/phase-NN-*.md` frontmatter still says `status: pending` for phases that are clearly complete (their success-criteria checkboxes are `[x]`). Same for `plans/260604-1542-admin-panel-user-transaction-management/plan.md` (status: pending, but the 5 phases and admin UI exist).
- **Files:** `plans/260604-1153-cloudflare-ai-gateway-api/phase-01..07-*.md`, `plans/260604-1542-admin-panel-user-transaction-management/plan.md`
- **Impact:** A future agent skimming the plans will think work is unstarted. Discrepancy between plan status and deployed reality.
- **Fix approach:** Sweep frontmatter to `status: complete` for shipped phases. Add a CI check that compares success-criteria `[x]` count to frontmatter status.

### Journal overstates what was fixed
- **Issue:** `docs/journals/260604-1314-cloudflare-ai-gateway-full-implementation.md:25-32` lists "Added HMAC-SHA256 verification to /api/billing/webhook" as a fixed item, but the actual code (`sepay-service.ts:24-30`) does plain string compare. The journal also says "Not yet deployed to Cloudflare" but `phase-07-testing-deploy.md` claims `[x] API Worker deployed`.
- **Files:** `docs/journals/260604-1314-cloudflare-ai-gateway-full-implementation.md`
- **Impact:** Trust in journals erodes; readers can't tell what state the code is actually in.
- **Fix approach:** Either fix the code to match the journal, or fix the journal to match the code. Add a checklist for the verifier to cross-reference.

## Performance Bottlenecks

### Token estimation is wildly inaccurate
- **Problem:** `Math.ceil(text.length / 4)` is a coarse heuristic. Vietnamese (multi-byte UTF-8), code (lots of punctuation), and non-ASCII payloads get estimated at ~25-50% of actual tokens. Cost calculation (`pricing-config.ts`) is then wrong.
- **Files:** `packages/api/src/services/gateway-service.ts:14-19`, `packages/api/src/services/token-counter-service.ts:3-11`
- **Impact:** Users are under/over-billed. A $0.01 request may cost Cloudflare $0.05 — the butchi margin erodes. Or users get free requests that cost the operator money.
- **Improvement path:** Use provider's `usage.total_tokens` from the response (already returned for OpenAI; not for Anthropic non-streaming). For pre-flight checks, use a Workers AI tokenizer or a more accurate per-model counter.

### Streaming output tokens are estimated as 50% of input
- **Problem:** `Math.ceil(inputTokens * 0.5)` is a wild guess used for streaming cost deduction. Streaming responses can't see the output token count until the stream completes.
- **Files:** `packages/api/src/routes/openai-routes.ts:75`, `packages/api/src/routes/anthropic-routes.ts:101`
- **Impact:** Streaming users pay an arbitrary amount. A long streaming response deducts 0.5x input even if the actual output is 10x. Either users get free LLM tokens or the operator loses money.
- **Improvement path:** For OpenAI streaming, parse SSE chunks and sum `usage.completion_tokens` from the final chunk (OpenAI includes it). For Anthropic, parse `message_delta` events. Deduct after, not before.

### RAG query is synchronous in the request path
- **Problem:** Every `/v1/chat/completions` call awaits: Workers AI embed (50-200ms) + Vectorize query (20-80ms) + R2 fetch for chunks (10-50ms per chunk, parallel via `Promise.all`). Adds 80-330ms latency to every request before it hits the AI Gateway.
- **Files:** `packages/api/src/services/rag-service.ts:48-131`, `packages/api/src/routes/openai-routes.ts:51-62`
- **Impact:** User-visible latency increase. Plan `phase-04-rag-integration.md` target was "<100ms" for full pipeline; current implementation likely misses it.
- **Improvement path:** Cache recent query embeddings in Workers KV (5-min TTL) keyed by message hash. Stream the LLM response while the RAG context loads in parallel. Add `x-rag-enabled: false` header (already supported) as a fast path.

### Admin list endpoints have no pagination
- **Problem:** `GET /api/admin/users` and `GET /api/admin/transactions` return every row. At 10k users or 100k transactions, the D1 query and JSON serialization blow past Worker memory limits (128MB).
- **Files:** `packages/api/src/routes/admin-user-routes.ts:16-23`, `packages/api/src/routes/admin-transaction-routes.ts:17-28`
- **Improvement path:** Add `?page=N&limit=M` query params. Use cursor-based pagination for transactions (sort by `created_at` + `id`).

### Indexer reads R2 sequentially with no parallelism
- **Problem:** `indexer-service.ts:65-94` iterates `for (const key of keys)` and embeds batches one at a time. With N=100 documents, total time is N × batch embed time.
- **Files:** `packages/api/src/services/indexer-service.ts:69-91`
- **Improvement path:** Use `Promise.all` over key batches (Workers AI has a per-minute quota — check rate limits). Stream objects via `r2.list({ limit })` paginated cursor.

### `r2.list` in indexer truncates at 1000 keys
- **Problem:** `r2-storage-service.listObjects` returns one page. R2's `list` defaults to 1000 items and the service doesn't paginate.
- **Files:** `packages/api/src/services/r2-storage-service.ts:7-10`
- **Impact:** Indexer silently skips docs beyond the first 1000.
- **Improvement path:** Loop with `r2.list({ cursor, limit: 1000 })` until `objects.truncated === false`.

## Fragile Areas

### OTP attempt-count logic is broken
- **Why fragile:** The "first valid attempt" branch and the "already had prior failed attempt" branch both call `markUsed` and return `true`. The second branch is named like a recovery path but actually validates a 2nd attempt — which should be `false` (the prior attempt already consumed the code).
- **Files:** `packages/api/src/services/otp-service.ts:73-87`
- **Current state:**
  ```ts
  if (row.attempt_count >= MAX_ATTEMPTS) return false;  // check
  await incrementAttempts(row.id);                       // increment
  if (row.attempt_count === 0) {                         // was this the 1st?
    await markUsed(row.id);
    return true;
  }
  await markUsed(row.id);
  return true;                                           // <-- also returns true!
  ```
  Since `incrementAttempts` is awaited but the local `row` object is from before the increment, `row.attempt_count` is the *previous* count. The `=== 0` check is true only on the very first attempt. Every other attempt falls into the second branch — which also returns `true`. The MAX_ATTEMPTS guard at the top is the only thing keeping brute force in check, and it only works because `markUsed` is also called in both branches.
- **Safe modification:** Distinguish the "wrong code" case (return `false`, do not `markUsed`) from the "right code, prior wrong attempts" case (`markUsed`, return `true`). Re-read the row after `incrementAttempts` to use the new count.
- **Test coverage:** The OTP test mock doesn't actually update `attempt_count` after UPDATE (see `__tests__/otp-service.test.ts:58-60`), so the broken branch isn't exercised.

### `extractEmbeddings` doesn't validate the Workers AI response
- **Why fragile:** `embedding-service.ts:10-15` casts `result` to `{ data: unknown }` and assumes `data` is `number[][]`. If Workers AI returns a different shape (rate limit, model not found, transient error), the cast lies and downstream code crashes with `data[0] is not a number`.
- **Files:** `packages/api/src/services/embedding-service.ts:10-15`
- **Safe modification:** Add a `typeof data[0][0] === "number"` check, and a typed error if shape mismatches. Surface to the caller as a typed `EmbeddingError` so the route can return 503 instead of 500.

### Pricing fallback silently charges gpt-4o-mini rate
- **Why fragile:** `pricing-config.ts:9`: `PRICING[model] ?? { inputPer1M: 15, outputPer1M: 60 }` — the default IS the gpt-4o-mini rate. When a new model ships (or someone misspells a model name), the user is billed at mini rates without any warning.
- **Files:** `packages/api/src/config/pricing-config.ts:8-10`
- **Safe modification:** Throw on unknown model in production; fall back to a clearly-marked "default" rate (e.g., 0 cost) in dev. Add a `validatePricing()` test that asserts every model in `PRICING` has a non-default price.

### `api_key.last_used_at` update on every request
- **Why fragile:** `api-key-middleware.ts:63-66` does a D1 `UPDATE` for every authenticated request. A high-volume key turns every request into 2 D1 writes (one for the auth lookup, one for `last_used_at`). At 1000 req/min, this is 2000 writes/min for one user.
- **Files:** `packages/api/src/middleware/api-key-middleware.ts:62-66`
- **Safe modification:** Batch `last_used_at` updates (e.g., only update if last update >1 min ago, or accumulate in memory and flush via `waitUntil`).

### Anthropic route discards content blocks
- **Why fragile:** `anthropic-routes.ts:72-75` flattens any non-text content block to its `text` field. Anthropic supports `image`, `tool_use`, `tool_result` — these are dropped, breaking tool use.
- **Files:** `packages/api/src/routes/anthropic-routes.ts:72-75`
- **Safe modification:** Map Anthropic content blocks to OpenAI's equivalent (`tool_use` → function calls; `image` → image_url) or return 400 for unsupported blocks.

### Two routers under `/v1`
- **Why fragile:** `index.ts:47` and `index.ts:50` both `app.route("/v1", ...)`. Today they have non-overlapping sub-paths (`/chat/completions` vs `/messages`). Future endpoints that collide will fail silently.
- **Files:** `packages/api/src/index.ts:47,50`
- **Safe modification:** Combine into a single `createV1Router()` that owns both sub-routes, or use distinct prefixes (`/openai`, `/anthropic`).

### Catch-all `app.all("*")` masks 404s
- **Why fragile:** `index.ts:66-69` falls through to `c.env.ASSETS.fetch(req)` for any non-API route. A typo'd API path (e.g., `/ap1/profile`) returns the dashboard's `index.html` with 200, not a 404. Hard to debug.
- **Files:** `packages/api/src/index.ts:66-69`
- **Safe modification:** Match the request to a known API prefix list; if not matched, return 404 explicitly before falling through to assets.

### `c.executionCtx` not present in all Hono contexts
- **Why fragile:** Several routes call `c.executionCtx.waitUntil(...)`. Hono's `Context` only exposes `executionCtx` when the runtime provides it (Cloudflare Workers does; Node/miniflare may not). Refactoring away from Workers would break these calls.
- **Files:** `packages/api/src/routes/openai-routes.ts:73`, `packages/api/src/routes/anthropic-routes.ts:99`, `packages/api/src/routes/admin-routes.ts:38`, `packages/api/src/routes/billing-proof-routes.ts:70`
- **Safe modification:** Wrap in `if (c.executionCtx)` or use the helper `getExecutionCtx(c)`. Or document the Workers-only contract.

## Scaling Limits

### In-memory rate limit doesn't scale horizontally
- **Current capacity:** 60 req/min per (API key or "global"), but only per Worker isolate.
- **Limit:** Cloudflare Workers can run hundreds of isolates per route. An attacker hitting different POPs effectively gets 60 × isolates req/min.
- **Scaling path:** Move to Durable Objects (consistent per-key counter) or Cloudflare's built-in Rate Limiting Rules (declarative, edge-side).

### SePay webhook idempotency relies on string equality
- **Current capacity:** One credit per `sepay_transaction_id` (D1 UNIQUE constraint).
- **Limit:** If the same `transactionId` arrives twice within milliseconds (network retry), the first handler may have read the row, decided to credit, and then the second handler reads the same row — both call `addCredit` (see TOCTOU race above).
- **Scaling path:** Single-statement state transition with `INSERT ... ON CONFLICT`.

### D1 write rate for usage logs
- **Current capacity:** Every gateway request triggers 1 INSERT into `usage_logs` (sync) and 1 UPDATE on `users.balance_cents`. Streaming adds the same in `waitUntil`.
- **Limit:** D1 has per-database write limits (~5 writes/sec on free, 5k/sec on paid). A single user with 10 RPS would saturate the free tier.
- **Scaling path:** Batch inserts via D1 batch API, or write to a queue (Cloudflare Queues) and a separate consumer writes to D1.

### `wrangler.toml` `compatibility_date` is 8 months stale
- **Date set:** `2024-10-01` (in `packages/api/wrangler.toml`).
- **Limit:** Cloudflare regularly backports bugfixes and security patches to the runtime; an old compatibility date misses those.
- **Scaling path:** Bump to the latest stable date and re-deploy. Run the wrangler upgrade check on each release.

## Dependencies at Risk

### `indexer-service.ts` re-running accumulates Vectorize entries
- **Risk:** `indexer-service.ts:80-87` upserts vectors with IDs `${key}:chunk:${i}` — re-running with the same key produces the same IDs, so this is fine. But if a key is renamed or a chunk is split, old vectors with the old ID remain. Vectorize doesn't support delete in the current service wrapper (`vectorize-service.ts:33-45` only has `upsert`).
- **Files:** `packages/api/src/services/vectorize-service.ts`
- **Migration plan:** Add `deleteByIds(ids)` to `vectorize-service.ts`. On reindex, delete old IDs first. If Vectorize's `delete` API is rate-limited, batch with cursor.

### `embedding-service.ts` hardcodes bge-base-en-v1.5
- **Risk:** If Workers AI deprecates `@cf/bge-base-en-v1.5`, every embed call breaks silently. `EMBEDDING_DIMENSIONS = 768` is baked into `Vectorize` index config.
- **Files:** `packages/api/src/services/embedding-service.ts:1-2`, `packages/api/wrangler.toml:28`
- **Migration plan:** Move model name to a config const at the top. Document the dimensions dependency in `wrangler.toml`. Plan a Vectorize re-index if dimensions change.

### `@cloudflare/vitest-pool-workers` is installed but unused
- **Risk:** Devdep is in `packages/api/package.json:19` but `vitest.config.ts` uses `environment: "node"`. Future contributors may add tests assuming the workers pool, only to find they don't run.
- **Files:** `packages/api/vitest.config.ts:1-9`, `packages/api/package.json:19`
- **Migration plan:** Either switch `vitest.config.ts` to `pool: "@cloudflare/vitest-pool-workers"` and use `SELF.fetch` for integration tests, or remove the devdep.

## Test Coverage Gaps

### API: only 4 service-level test files; zero route/integration tests
- **What's not tested:** Every route in `packages/api/src/routes/`. Webhook signature verification, billing flow, balance deduction race, admin auth, OTP rate limiting, API key middleware. Plan `phase-07-testing-deploy.md:33-36` listed 4 more test files that don't exist.
- **Files:** `packages/api/src/services/__tests__/` (only `billing-service`, `jwt-service`, `otp-service`, `token-counter-service` exist)
- **Risk:** Refactoring any route is a high-risk change. The webhook + billing + auth bugs above would have been caught by integration tests against the route handlers.
- **Priority:** High

### Dashboard: zero test framework configured
- **What's not tested:** Any component logic. The XSS in `api-keys.astro`, the JWT-decode in `dashboard-layout.astro`, the cookie flow in `otp-form.tsx`, the chart math in `usage-chart.tsx`.
- **Files:** `packages/dashboard/src/components/*`, `packages/dashboard/src/pages/dashboard/*`, `packages/dashboard/src/layouts/*`
- **Risk:** UI changes can silently break the auth flow or introduce XSS.
- **Priority:** Medium — dashboard is read-mostly with limited business logic, but the inline `onclick` interpolation is dangerous.

### OTP mock doesn't simulate UPDATE side-effects
- **What's not tested:** The real-world behavior of `incrementAttempts` and `markUsed`. The test passes because the mock returns `null` for UPDATE statements without actually mutating state, so the broken attempt-count branch is never reached.
- **Files:** `packages/api/src/services/__tests__/otp-service.test.ts:58-60`
- **Risk:** The OTP attempt-count logic bug above is hidden by the test mock.
- **Priority:** High (because it conceals a real bug).

### `run_worker_first = true` skips asset caching
- **File:** `packages/api/wrangler.toml:39`
- **Why fragile:** Every asset request (CSS, JS, fonts) runs through the full Worker. No edge caching. Cost increases with traffic.
- **Safe modification:** Switch to `run_worker_first = false` and add an explicit `/api/*` matcher in `index.ts` for the API routes only. Static assets bypass the Worker.

## Missing Critical Features

### No way to invalidate a stolen JWT
- **Problem:** Logout deletes the client cookie, but the JWT remains valid for up to 1h (`jwt-service.ts:46`). A stolen token cannot be revoked.
- **Block:** Users with leaked tokens have no recourse. Admin cannot force-logout a user mid-session.
- **Approach:** Add a `revoked_at` column to `users` (or a per-token revocation list). On every request, check the JWT's `iat` against `revoked_at`; reject tokens issued before the revocation.

### No 2FA for the admin account
- **Problem:** Admin email is hardcoded (`packages/api/src/config/admin-config.ts:1`). Whoever compromises the admin's email OTP gains full admin access.
- **Block:** Admin account is a single point of failure.
- **Approach:** Add TOTP second factor for `role === "admin"`; require re-auth for sensitive admin actions.

### No structured logging / observability
- **Problem:** All errors go to `console.error` and are lost beyond Cloudflare's log retention. No metrics, no traces, no alertable signals for unusual webhook volume, balance changes, or rate-limit hits.
- **Files:** `packages/api/src/services/*.ts`, `packages/api/src/routes/*.ts` (every `console.error` site)
- **Block:** Debugging production issues requires Cloudflare's dashboard; can't see request-level traces.
- **Approach:** Send structured logs to a log sink (Logpush + R2, or a third-party). Add counters for webhook volume, billing changes, OTP failures. Trace gateway latency.

---

*Concerns audit: 2026-06-04*
