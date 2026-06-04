# External Integrations

**Analysis Date:** 2026-06-04

## APIs & External Services

**AI Inference (Cloudflare AI Gateway):**
- Cloudflare AI Gateway — proxies OpenAI/Anthropic-format requests through `https://gateway.ai.cloudflare.com/v1/{gatewayId}/openai/chat/completions`
  - Client: raw `fetch` in `packages/api/src/services/gateway-service.ts:23`
  - Auth: `Authorization: Bearer <apiKey>` (passes through user-supplied provider key)
  - Gateway binding: `AI_GATEWAY` in `wrangler.toml` (id `butchi-gateway`)
  - Used by: `openai-routes.ts`, `anthropic-routes.ts`

**Transactional Email (Emailit):**
- Emailit v2 API — `https://api.emailit.com/v2/emails`
  - Client: raw `fetch` in `packages/api/src/services/email-service.ts:10`
  - Auth: `Authorization: Bearer ${EMAILIT_API_KEY}` (env: `EMAILIT_API_KEY`)
  - Use cases: OTP code delivery (`sendOtp`), admin payment-proof notifications (`sendProofNotification`)
  - Fallback: logs to console in dev if key missing

**Embedding Model (Workers AI):**
- Cloudflare Workers AI model `@cf/bge-base-en-v1.5` — 768-dim BGE embeddings
  - Client: `ai.run()` binding in `packages/api/src/services/embedding-service.ts:1`
  - Binding: `ai = { binding = "AI" }` in `wrangler.toml`
  - Used by: `embedding-service.ts`, `indexer-service.ts`, `rag-service.ts`
  - Batch size limited to 10 inputs per request (in `embedBatch`)

**Vietnamese Bank QR (SePay):**
- SePay QR image generator — `https://qr.sepay.vn/img?acc={account}&bank={bankCode}&amount={vnd}&des={transactionId}&template=compact`
  - Client: URL builder in `packages/api/src/services/sepay-service.ts:19`
  - Default bank code: `970436` (Vietcombank) — overridable via `SEPAY_BANK_CODE`
  - Default account name: `BUTCHI` — overridable via `SEPAY_ACCOUNT_NAME`
  - Account number required: `SEPAY_ACCOUNT_NUMBER`
  - No SDK; the URL is rendered directly in `<img src>` from the dashboard (`packages/dashboard/src/pages/dashboard/billing.astro:58`)

**Web Fonts (Google Fonts):**
- IBM Plex Sans (weights 300, 400, 600) — `<link>` from `fonts.googleapis.com` in both layouts (`packages/dashboard/src/layouts/dashboard-layout.astro:18`, `auth-layout.astro:14`)
- No key, no API; standard CSS link

## Data Storage

**Cloudflare D1 (SQLite at edge):**
- Database name: `butchi-db`
- Database ID: `e4143f19-8b24-47ad-bd92-fd56abc05e60` (`wrangler.toml`)
- Binding: `DB: D1Database`
- Client: native D1 prepared statements (`db.prepare(...).bind(...).run() / .first<T>() / .all<T>()`)
- Migrations: `packages/api/migrations/` (applied via `wrangler d1 migrations apply butchi-db --remote` in `deploy.sh`)
- Schema: `packages/api/src/db/schema.sql` (reference) — tables `users`, `otp_codes`, `api_keys`, `usage_logs`, `billing_records`, `topup_records`; index `idx_*` on email/user_id/created_at
- ORM: None — raw SQL only

**Cloudflare R2 (object storage):**
- Bucket: `butchi-rag`
- Binding: `R2: R2Bucket`
- Client: `r2.list({ prefix })`, `r2.get(key)`, `r2.put(key, body, { httpMetadata })` — see `packages/api/src/services/r2-storage-service.ts`, `r2-storage-service.ts` wrapper plus direct usage in `billing-proof-routes.ts:56,100`
- Use cases: RAG source documents (key prefix controlled by RAG indexer) and payment proof uploads (prefix `payment-proofs/{topupId}/`, validated types: JPG/PNG/PDF, max 2MB per `proof-upload-service.ts:1-2`)

**Cloudflare Vectorize (vector index):**
- Index: `butchi-rag-index`
- Binding: `VECTORIZE: VectorizeIndex`
- Client: `index.query(vector, { topK, returnValues, returnMetadata })` and `index.upsert([{ id, values, metadata }])` — see `packages/api/src/services/vectorize-service.ts`
- Metadata schema: `{ r2_key: string, chunk_index: string, preview: string }`
- RAG config (header-driven): `x-rag-enabled`, `x-rag-max-tokens` (default 2000), `x-rag-top-k` (default 5), `x-rag-similarity-threshold` (default 0.7) — parsed in `packages/api/src/services/rag-service.ts:30`

**File Storage (local / non-Cloudflare):**
- None — R2 covers all object storage needs

**Caching:**
- None at the application layer
- In-process rate-limit counters only (`packages/api/src/middleware/rate-limit-middleware.ts:12` — `Map<string, { count, resetAt }>`, resets on redeploy)
- AI Gateway performs its own upstream caching of provider responses

## Authentication & Identity

**Auth Provider:**
- Custom — no third-party auth (no Auth0/Clerk/Supabase Auth/etc.)
- OTP flow: 6-digit code stored in D1 (`otp_codes` table), 5-min expiry, max 3 codes per email per 10-min window, max 5 attempts per code — see `packages/api/src/services/otp-service.ts`
- Session: JWT HS256, 1-hour expiry, `sub`/`email`/`role`/`iat`/`exp` claims — see `packages/api/src/services/jwt-service.ts` (uses Web Crypto `crypto.subtle`, no external JWT lib)
- Token transport: stored in `document.cookie` by dashboard (`packages/dashboard/src/components/otp-form.tsx:32` — `token=<jwt>; path=/; max-age=3600; SameSite=Strict; Secure`), sent as `Authorization: Bearer <token>` for `/api/*` routes
- Admin bootstrap: the first user with email `ngoclam.lai@gmail.com` (`ADMIN_EMAIL` in `packages/api/src/config/admin-config.ts`) is auto-assigned `role = "admin"` on OTP verify (`auth-routes.ts:72`)

**API Key Auth (gateway routes `/v1/*`):**
- Custom — format `sk-<base64url>` (32 random bytes), 12-char prefix stored for display
- Hashed with SHA-256 in `packages/api/src/middleware/api-key-middleware.ts:11-15` (Web Crypto `crypto.subtle.digest`)
- Stored: `key_hash`, `key_prefix`, `name`, `revoked`, `last_used_at` in D1 `api_keys` table
- Plaintext key returned only once at creation (`packages/api/src/routes/api-key-routes.ts:51`)

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry / Bugsnag / similar

**Logs:**
- `hono/logger` middleware on `app.use("*", logger())` in `packages/api/src/index.ts:37` (request/response logging to stdout)
- `console.log` / `console.error` throughout services (OTP fallback, email errors, RAG errors, usage log errors, SePay webhook errors)
- No structured logging, no log shipping

**Health Check:**
- `GET /health` in `packages/api/src/index.ts:39` returns `{ status: "ok", environment }` — no deep dependency checks

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers — single Worker (`name = "butchi-api"`, runtime `workerd`)
- Public URL: `https://butchi-api.ngoclamlai.workers.dev` (printed by `deploy.sh`)
- Same Worker serves API routes (`/v1/*`, `/api/*`) AND static dashboard assets via the `ASSETS` binding (catch-all in `packages/api/src/index.ts:66-69`)

**CI Pipeline:**
- None committed — no `.github/workflows`, no `ci.yml`
- Manual deploy via `deploy.sh` at repo root: install → D1 migrate → astro build → wrangler deploy

**Build Pipeline Order (`deploy.sh`):**
1. `pnpm install` — workspace install
2. `wrangler d1 migrations apply butchi-db --remote` — apply SQL migrations
3. `pnpm --filter dashboard build` — produce `packages/dashboard/dist/`
4. `wrangler deploy` — bundles `src/index.ts` + bundles dashboard dist into Worker assets

## Environment Configuration

**Required env vars (`packages/api`):**
- `JWT_SECRET` — HS256 signing key (required for auth)
- `OTP_EMAIL_FROM` — sender address (default `noreply@butchi.ai`, set in `wrangler.toml [vars]`)
- `ENVIRONMENT` — string label (default `production`)
- `SEPAY_BANK_CODE` — default `970436` (Vietcombank)
- `SEPAY_ACCOUNT_NUMBER` — required for QR generation to be useful
- `SEPAY_ACCOUNT_NAME` — default `BUTCHI`
- `SEPAY_WEBHOOK_SECRET` — required to verify incoming SePay webhooks
- `EMAILIT_API_KEY` — required for OTP email delivery; optional in dev (falls back to console log)

**Dashboard env vars:**
- `PUBLIC_API_URL` — Astro public env (Vite-style), consumed in `packages/dashboard/src/lib/api-client.ts:1`; defaults to empty string (same-origin requests)

**Secrets location:**
- Local dev: `.dev.vars` (gitignored) — see `.dev.vars.example` at repo root
- Production: `wrangler secret put` (no committed production secrets; configured via Wrangler CLI / dashboard)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/sepay` — SePay bank transfer notification
  - Auth: `Authorization: Apikey <SEPAY_WEBHOOK_SECRET>` (compared in `webhook-routes.ts:32`)
  - Body shape (SePay payload): `{ id, gateway, transactionDate, accountNumber, subAccount, code, content, transferType, description, transferAmount, accumulated, referenceCode }`
  - Behavior: matches incoming transfer amount/code against a pending `topup_records` row, then `billing.addCredit(...)` and flips status to `confirmed` — see `packages/api/src/routes/webhook-routes.ts`

**Outgoing:**
- None — the system does not initiate HTTP callbacks to third parties
- All external HTTP calls are inbound requests proxied through AI Gateway (`/v1/chat/completions`, `/v1/messages`) and outbound email sends via Emailit
- Email sends are fire-and-forget for proof notifications (`c.executionCtx.waitUntil(...)` in `billing-proof-routes.ts:70`)

---

*Integration audit: 2026-06-04*
