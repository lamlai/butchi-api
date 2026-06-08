# Roadmap: butchi-api

**Project:** butchi-api — B2D AI API Platform trên Cloudflare
**Granularity:** Coarse (5 phases)
**Total v1 Requirements:** 66
**Coverage:** 66/66 mapped ✓

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Foundation & Auth | Worker + dashboard deploy được, OTP login work, admin role bootstrap, infra baseline | 16 | 5 |
| 2 | API Gateway & Models | OpenAI/Anthropic-compat API live với API keys, usage tracking, RAG inject, balance gate | 22 | 5 |
| 3 | RAG Corpus Management | Admin upload/manage KB, tự động chunk+embed+index | 9 | 4 |
| 4 | Billing & Admin Ops | SePay topup end-to-end, admin user/transaction management | 14 | 5 |
| 5 | Dashboard Pages & Playground | Studio, Usage, Profile, Playground với i18n | 7 | 4 |

## Phase Details

### Phase 1: Foundation & Auth

**Goal:** Working Cloudflare Worker + Astro dashboard deployed, OTP email login functional, admin role auto-assigned, infrastructure baseline (D1 schema, logging, health, deploy script, i18n setup).

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-05, INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, I18N-01, UI-09, UI-10, ADM-06, ADM-07

**Success Criteria:**
1. `pnpm dev` start cả API + dashboard locally; truy cập `http://localhost:8787/login` thấy OTP form
2. User nhập email → nhận OTP qua Emailit → nhập code → redirect `/dashboard/studio` với JWT cookie
3. Nếu email khớp `ADMIN_EMAIL` env, user.role = 'admin' trong D1; admin link xuất hiện trong sidebar
4. `pnpm typecheck` + `pnpm build` pass; `bash deploy.sh` deploy thành công lên `butchi-api.*.workers.dev`
5. `GET /health` returns `{ status: 'ok', env, version }`; structured logs visible trong wrangler tail

**Plans (anticipated):**
- 1.1: Worker + Astro scaffold + D1 schema + migrations + wrangler config
- 1.2: OTP email service + auth routes + JWT middleware + login page
- 1.3: Dashboard layout + sidebar + i18n setup + deploy script + health endpoint

---

### Phase 2: API Gateway & Models

**Goal:** OpenAI/Anthropic-compatible API live, support multiple models (Workers AI + OpenAI + Anthropic), API key management với usage tracking, RAG context tự động inject, balance check.

**Requirements:** API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, API-09, MODL-01, MODL-02, MODL-03, MODL-04, MODL-05, MODL-06, RAG-06, RAG-07, RAG-09, BILL-01, BILL-02, UI-05

**Success Criteria:**
1. User tạo API key trong dashboard, copy raw `sk-...`; revoke works; key SHA-256 hash in D1
2. `curl -X POST /v1/chat/completions -H "Authorization: Bearer sk-..."` với body OpenAI-shape → returns completion; balance bị trừ
3. Same với Anthropic-shape body → translates to OpenAI → returns Anthropic-shape response
4. `stream: true` returns SSE event stream; usage log ghi trong `executionCtx.waitUntil` (không block)
5. RAG enabled per request → context từ Vectorize tự động prepend vào system message; nếu disable thì chat thuần

**Plans (anticipated):**
- 2.1: API key routes + middleware + billing service (balance check, deduct, log)
- 2.2: OpenAI compat route + rate limit + model routing (Workers AI / OpenAI / Anthropic)
- 2.3: Anthropic compat route + OpenAI ↔ Anthropic translation
- 2.4: RAG inject service (embed → vectorize query → R2 fetch → context build)
- 2.5: Pricing config + model deals/multipliers + API keys UI page

---

### Phase 3: RAG Corpus Management

**Goal:** Admin upload files lên R2, hệ thống tự động chunk + embed + index vào Vectorize, manual reindex trigger, KB management UI cho admin.

**Requirements:** RAG-01, RAG-02, RAG-03, RAG-04, RAG-05, RAG-08, ADM-03, ADM-04

**Success Criteria:**
1. Admin upload PDF/DOCX/MD qua dashboard → file xuất hiện trong R2 bucket + chunk count hiển thị
2. Embeddings tự động tạo trong background (Workers AI bge-base-en-v1.5, 768-dim) và upsert vào Vectorize với metadata
3. Admin trigger "Reindex all" → progress visible; sau khi xong thì per-request RAG flow tìm được chunks mới
4. Admin xem được: file list với size, chunk count, last indexed, delete button; Vectorize query confirm từ admin test

**Plans (anticipated):**
- 3.1: File upload route + R2 storage service + indexer service (chunk + embed + upsert)
- 3.2: Admin reindex route (background `waitUntil` + status tracking) + KB management UI

---

### Phase 4: Billing & Admin Operations

**Goal:** SePay QR topup end-to-end, webhook auto-confirm, topup history, admin user/transaction management với manual override.

**Requirements:** AUTH-04, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08, I18N-02, UI-04, ADM-01, ADM-02, ADM-05

**Success Criteria:**
1. User click "Top up" → tạo pending topup record → SePay QR hiển thị với nội dung chứa mã → user chuyển khoản → SePay webhook fires → balance tự động cộng → topup record confirmed
2. Idempotency: replay webhook với cùng `sepay_transaction_id` → không double-credit
3. Admin thấy: users table (filter by status/role, deactivate button), transactions table (manual confirm/reject cho pending), system stats widget
4. User upload payment proof (screenshot) cho manual review khi QR fail → admin nhận được và confirm/reject
5. Balance display VND ↔ USD cents conversion đúng; insufficient balance warning trước khi call

**Plans (anticipated):**
- 4.1: SePay service + QR generation + webhook route + idempotency
- 4.2: Topup routes (create pending, history, proof upload) + billing page UI
- 4.3: Admin users + transactions routes + UI + manual confirm/reject + stats widget
- 4.4: Admin deactivate user flow + balance display formatting

---

### Phase 5: Dashboard Pages & Playground

**Goal:** Studio overview, Usage charts, Profile page, interactive Playground để user test API trước khi integrate, language switcher.

**Requirements:** UI-02, UI-03, UI-06, UI-07, UI-08, I18N-03, I18N-04

**Success Criteria:**
1. Studio page shows: welcome, usage summary cards (cost, tokens, runs — same layout như reference UI), quick links
2. Usage page: SVG-based bar charts cho tokens/day và cost/day 30d, breakdown by model
3. Profile page: avatar (initials fallback), email, joined date formatted by locale, change email via OTP re-verify
4. Playground: model selector dropdown, system prompt textarea, RAG toggle, messages list, send/receive streaming, cost estimate trước khi send
5. Language switcher: chuyển Vietnamese ↔ English, persists trong localStorage + cookie, date/number formatting update real-time

**Plans (anticipated):**
- 5.1: Studio + Usage pages (with usage chart React island)
- 5.2: Profile page (with avatar, change email flow)
- 5.3: Playground page (chat UI + streaming + cost estimate)
- 5.4: i18n date/number formatting + language switcher

---

## Build Order & Dependencies

```
Phase 1 (Foundation)
   ↓
Phase 2 (API Gateway) ←── needs Phase 1's D1 schema + auth
   ↓
Phase 3 (RAG Corpus) ←── needs Phase 2's RAG inject service
   ↓
Phase 4 (Billing) ←── needs Phase 2's usage tracking + balance
   ↓
Phase 5 (Dashboard Polish) ←── needs Phase 4's billing UI + Phase 2's usage data
```

## Out of Scope (v1)

Confirmed exclusions (chi tiết trong REQUIREMENTS.md → Out of Scope):
- Social features (followers, activity streak, pinned taste packages)
- OAuth login
- Subscription plans (recurring)
- Multi-tenant KB
- Real-time streaming UI in playground
- Mobile native app
- Outbound webhooks
- Vectorize alternative
- Self-hosted model serving
- Multi-region deployment
- Credits transfer between users
- Auto-refund for unused credits

## Validation Checklist

- [x] Mỗi v1 requirement map đến exactly 1 phase
- [x] Phases derive từ requirements (không impose structure)
- [x] 2-5 success criteria per phase (4-5 actual)
- [x] Build order respects dependencies
- [x] 100% coverage: 66/66 v1 requirements mapped

---

*Roadmap created: 2026-06-08*
*Granularity: Coarse (3-5 phases, 1-3 plans each)*
