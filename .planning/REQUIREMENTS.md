# Requirements: butchi-api

**Defined:** 2026-06-08
**Core Value:** Developer VN có thể gọi AI API (OpenAI/Anthropic compatible) với RAG grounding từ shared knowledge base, trả tiền bằng VND (SePay) friction thấp.

## v1 Requirements

Requirements cho initial release. Mỗi requirement map đến roadmap phases.

### Authentication & Identity

- [ ] **AUTH-01**: User có thể đăng ký/đăng nhập bằng OTP email (qua Emailit, không password)
- [ ] **AUTH-02**: JWT session persist trong HttpOnly cookie và refresh trên browser refresh
- [ ] **AUTH-03**: Admin role bootstrap tự động từ `ADMIN_EMAIL` env var (lamlai)
- [ ] **AUTH-04**: Admin có thể deactivate user; user bị deactivate không thể gọi API hoặc login
- [ ] **AUTH-05**: User có thể logout từ bất kỳ page nào

### API Gateway

- [ ] **API-01**: OpenAI-compatible `POST /v1/chat/completions` nhận Bearer `sk-...` API key
- [ ] **API-02**: Anthropic-compatible `POST /v1/messages` cùng pipeline, translate OpenAI ↔ Anthropic
- [ ] **API-03**: Cả hai endpoint support `stream: true` SSE passthrough
- [ ] **API-04**: User có thể tạo API key trong dashboard (name + scopes), raw key chỉ hiển thị 1 lần
- [ ] **API-05**: API key SHA-256 hash lưu D1; raw key không bao giờ recover được
- [ ] **API-06**: User có thể list/revoke API keys của mình
- [ ] **API-07**: Rate limit per API key (60 req/min default, configurable)
- [ ] **API-08**: Mỗi request ghi usage log: input tokens, output tokens, cost cents, model, timestamp, latency
- [ ] **API-09**: Streaming usage log fire-and-forget qua `executionCtx.waitUntil` (không block stream)

### RAG (Shared Knowledge Base)

- [ ] **RAG-01**: Admin upload file (PDF, DOCX, MD, TXT) lên R2 qua dashboard
- [ ] **RAG-02**: Hệ thống chunk văn bản (~500 tokens, 50 overlap) tự động sau upload
- [ ] **RAG-03**: Hệ thống embed mỗi chunk qua Workers AI `@cf/bge-base-en-v1.5` (768-dim)
- [ ] **RAG-04**: Embeddings upsert vào Vectorize với metadata {r2_key, chunk_index, preview}
- [ ] **RAG-05**: Admin có thể trigger manual reindex cho toàn bộ corpus hoặc prefix
- [ ] **RAG-06**: Per-request RAG flow: embed last user message → query Vectorize top-K → fetch chunks từ R2 → prepend context vào system message
- [ ] **RAG-07**: RAG config per request (header hoặc body): top-K, similarity threshold, prefix filter
- [ ] **RAG-08**: Admin xem được danh sách files trong KB, chunk count, last indexed timestamp
- [ ] **RAG-09**: RAG hoàn toàn tắt được (opt-out per request) cho request chỉ muốn chat thuần

### Model Support

- [ ] **MODL-01**: Cloudflare Workers AI native (Llama 3.x, Qwen 2.5, Mistral, Phi) qua `c.env.ai` binding
- [ ] **MODL-02**: OpenAI upstream (GPT-4o, GPT-4.1, o1, o3-mini, GPT-4.1-mini) qua admin's API key
- [ ] **MODL-03**: Anthropic upstream (Claude Sonnet 4.5, Haiku 4, Opus 4) qua admin's API key
- [ ] **MODL-04**: Per-model pricing table (USD cents per 1M input/output tokens) configurable in code
- [ ] **MODL-05**: Model deals/multipliers (vd: 4× usage cho DeepSeek, free cho 1 số model) — track discount trong usage log
- [ ] **MODL-06**: User chọn được model khi gọi API (`model` field trong OpenAI/Anthropic body)

### Billing & Payments

- [ ] **BILL-01**: Pay-per-token: user balance (USD cents) trừ dần theo usage log
- [ ] **BILL-02**: Insufficient balance → request reject với HTTP 402 + error message rõ ràng
- [ ] **BILL-03**: SePay QR topup: admin tạo pending topup record → user quét QR với nội dung chứa mã → SePay webhook xác nhận → auto-cộng credits
- [ ] **BILL-04**: SePay webhook idempotent (skip nếu `topup_records.sepay_transaction_id` đã confirmed)
- [ ] **BILL-05**: Topup history list với status (pending / confirmed / rejected) + amount VND + credits USD
- [ ] **BILL-06**: VND ↔ USD cents conversion rate configurable (env var `VND_USD_RATE`)
- [ ] **BILL-07**: User dashboard hiển thị balance real-time + top CTA khi balance < threshold
- [ ] **BILL-08**: User có thể upload payment proof (screenshot) cho manual review nếu QR fail — admin confirm/reject

### Dashboard (User-facing)

- [ ] **UI-01**: Login page (OTP form, React island, 6-digit code input, countdown resend)
- [ ] **UI-02**: Studio/overview page (welcome, usage summary cards, quick links: Billing, API Keys, Usage)
- [ ] **UI-03**: Usage page (charts: tokens/day 30d, cost/day 30d, breakdown by model)
- [ ] **UI-04**: Billing page (balance card, topup history table, topup CTA → SePay QR, payment proof upload)
- [ ] **UI-05**: API Keys page (list keys, create new key modal với raw key reveal-once, revoke button)
- [ ] **UI-06**: Profile page (avatar, email, joined date, change email via OTP re-verify)
- [ ] **UI-07**: Playground page (chat UI với model selector, system prompt input, RAG toggle, send/receive messages)
- [ ] **UI-08**: Playground tính phí theo usage y hệt API call (cảnh báo cost trước khi gửi)
- [ ] **UI-09**: Dashboard layout: sidebar nav (Studio, Playground, Usage, Billing, API Keys, Profile) + admin link nếu role=admin
- [ ] **UI-10**: Responsive desktop-first, mobile acceptable (chỉ breakpoint chính)

### Admin Dashboard

- [ ] **ADM-01**: Users management page (table: email, role, status, balance, total spent, last active; filter by status/role; deactivate/reactivate button)
- [ ] **ADM-02**: Transactions page (table: user, amount VND, credits USD, status, timestamp; manual confirm/reject cho pending records không match QR)
- [ ] **ADM-03**: KB Management page (file upload form, list R2 objects với size + chunk count, last indexed, delete button)
- [ ] **ADM-04**: Reindex trigger (button "Reindex all" + "Reindex prefix", status: idle/running/error, last run timestamp)
- [ ] **ADM-05**: System stats widget (total users, total revenue, total tokens, top models)
- [ ] **ADM-06**: Admin link visible trong sidebar chỉ khi user.role === 'admin'
- [ ] **ADM-07**: Admin middleware reject tất cả `/api/admin/*` nếu không phải admin (HTTP 403)

### Infrastructure & Observability

- [ ] **INFRA-01**: Single Cloudflare Worker serve cả API + dashboard qua `ASSETS` binding (`run_worker_first = true`)
- [ ] **INFRA-02**: D1 schema với migrations: users, api_keys, otp_codes, usage_logs, topup_records, rag_documents
- [ ] **INFRA-03**: Health endpoint `GET /health` → `{ status: 'ok', env, version }`
- [ ] **INFRA-04**: Structured logging: `hono/logger` cho HTTP access + `console.error` cho service errors
- [ ] **INFRA-05**: One-shot deploy script (`deploy.sh`): `pnpm install` → `wrangler d1 migrations apply --remote` → `astro build` → `wrangler deploy`
- [ ] **INFRA-06**: Local dev với `wrangler dev` + `.dev.vars` (JWT_SECRET, EMAILIT_API_KEY, SEPAY_*, OPENAI_API_KEY, ANTHROPIC_API_KEY, ADMIN_EMAIL, VND_USD_RATE)
- [ ] **INFRA-07**: Error responses consistent shape: `{ error: string, code?: string }` với HTTP status phù hợp
- [ ] **INFRA-08**: Secrets stored qua `wrangler secret put` cho production, `.dev.vars` cho local (gitignored)

### Internationalization

- [ ] **I18N-01**: Vietnamese-first UI — default locale `vi`, mọi string trong `vi.json` + `en.json`
- [ ] **I18N-02**: Currency display VND cho topup amounts, USD cents cho balance (convert on render)
- [ ] **I18N-03**: Date format theo locale (vi-VN dd/MM/yyyy, en-US MM/dd/yyyy)
- [ ] **I18N-04**: Switcher ngôn ngữ trong user menu (lưu preference vào localStorage + cookie)

## v2 Requirements

Deferred cho future release. Tracked nhưng không trong current roadmap.

### Multi-tenant KB

- **MTKB-01**: User tạo KB riêng (scoped theo user_id)
- **MTKB-02**: KB CRUD API (create, list, update, delete)
- **MTKB-03**: Per-request KB selection (header `X-KB-Id`)

### Advanced RAG

- **RAG-10**: Hybrid search (BM25 + vector) cho better recall
- **RAG-11**: Re-ranking với cross-encoder model
- **RAG-12**: Citations trong API response (chunk sources + scores)
- **RAG-13**: Web URL crawling (sitemap hoặc recursive) cho knowledge base
- **RAG-14**: Notion / Google Drive OAuth sync

### Subscription

- **SUB-01**: Monthly subscription plans (Free, GO, PRO, MAX, ULTRA) với recurring credits
- **SUB-02**: Auto-recurring qua SePay hoặc Stripe
- **SUB-03**: Plan upgrade/downgrade với proration

### Models Expansion

- **MODL-07**: User tự thêm API key của riêng mình (BYO key) — bypass admin's key
- **MODL-08**: Model fallback chain (nếu primary fail → fallback)
- **MODL-09**: Image generation models (DALL-E, Stable Diffusion)
- **MODL-10**: Embedding models alternative (OpenAI text-embedding-3, Cohere)

### Social & Engagement

- **SOCL-01**: Public user profiles
- **SOCL-02**: Followers / following
- **SOCL-03**: Pinned taste packages (saved prompt collections)
- **SOCL-04**: Activity streak + leaderboard
- **SOCL-05**: Share playground conversation (public link)

### Observability

- **OBS-01**: Request tracing với trace ID xuyên suốt middleware/services
- **OBS-02**: Tail logs dashboard (Cloudflare Workers Logs) cho admin
- **OBS-03**: Cost analytics per model / per user / per day
- **OBS-04**: Rate limit observability (current count, reset time, blocked requests)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Social features (followers, activity streak, pinned taste packages) | Không core cho B2D API platform; v2 |
| OAuth (Google/GitHub login) | Friction cao cho target dev VN; OTP email đủ |
| Subscription plans hàng tháng | Pay-per-token đơn giản hơn cho v1 |
| Multi-tenant KB (mỗi user có KB riêng) | Shared corpus đủ cho v1 use case |
| Real-time streaming UI trong playground (SSE) | Polling đủ cho v1 |
| Mobile native app | Web-first |
| Outbound webhook (notify khi hết credits) | In-app warning đủ |
| Vectorize alternative (Pinecone, Weaviate) | Workers AI + Vectorize combo CF-native |
| Self-hosted model serving | Chỉ upstream API + Workers AI |
| Multi-region deployment | Single region CF đủ cho v1 |
| Credits transfer giữa users | Anti-feature (tránh fraud/money laundering) |
| Refund flow cho unused credits | Manual qua admin nếu cần |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 4 | Pending |
| AUTH-05 | Phase 1 | Pending |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 2 | Pending |
| API-05 | Phase 2 | Pending |
| API-06 | Phase 2 | Pending |
| API-07 | Phase 2 | Pending |
| API-08 | Phase 2 | Pending |
| API-09 | Phase 2 | Pending |
| RAG-01 | Phase 3 | Pending |
| RAG-02 | Phase 3 | Pending |
| RAG-03 | Phase 3 | Pending |
| RAG-04 | Phase 3 | Pending |
| RAG-05 | Phase 3 | Pending |
| RAG-06 | Phase 2 | Pending |
| RAG-07 | Phase 2 | Pending |
| RAG-08 | Phase 3 | Pending |
| RAG-09 | Phase 2 | Pending |
| MODL-01 | Phase 2 | Pending |
| MODL-02 | Phase 2 | Pending |
| MODL-03 | Phase 2 | Pending |
| MODL-04 | Phase 2 | Pending |
| MODL-05 | Phase 2 | Pending |
| MODL-06 | Phase 2 | Pending |
| BILL-01 | Phase 2 | Pending |
| BILL-02 | Phase 2 | Pending |
| BILL-03 | Phase 4 | Pending |
| BILL-04 | Phase 4 | Pending |
| BILL-05 | Phase 4 | Pending |
| BILL-06 | Phase 4 | Pending |
| BILL-07 | Phase 4 | Pending |
| BILL-08 | Phase 4 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 2 | Pending |
| UI-06 | Phase 5 | Pending |
| UI-07 | Phase 5 | Pending |
| UI-08 | Phase 5 | Pending |
| UI-09 | Phase 1 | Pending |
| UI-10 | Phase 1 | Pending |
| ADM-01 | Phase 4 | Pending |
| ADM-02 | Phase 4 | Pending |
| ADM-03 | Phase 3 | Pending |
| ADM-04 | Phase 3 | Pending |
| ADM-05 | Phase 4 | Pending |
| ADM-06 | Phase 1 | Pending |
| ADM-07 | Phase 1 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Pending |
| INFRA-07 | Phase 1 | Pending |
| INFRA-08 | Phase 1 | Pending |
| I18N-01 | Phase 1 | Pending |
| I18N-02 | Phase 4 | Pending |
| I18N-03 | Phase 5 | Pending |
| I18N-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 65 total
- Mapped to phases: 65
- Unmapped: 0 ✓

---

*Requirements defined: 2026-06-08*
*Last updated: 2026-06-08 after initial definition*
