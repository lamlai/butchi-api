# butchi-api

## What This Is

B2D (Business-to-Developer) AI API Platform chạy trên Cloudflare, cung cấp OpenAI/Anthropic-compatible API cho end-user (developers) với RAG context tự động inject từ một shared knowledge base do admin quản lý. Developer mua credits bằng VND qua SePay QR, gọi API trả pay-per-token. Admin (lamlai) upload tài liệu lên R2 → hệ thống chunk + embed (Workers AI bge-base-en-v1.5) + index vào Vectorize; tất cả user cùng query KB đó. UI gồm Dashboard (Studio, Usage, Billing, API Keys, Profile) + Admin panel (Users, Transactions, KB Management) + Playground để test trước khi integrate.

## Core Value

Developer VN có thể gọi AI API (OpenAI/Anthropic compatible) với RAG grounding từ shared knowledge base, trả tiền bằng VND (SePay) friction thấp, không cần setup multi-provider hay tự build RAG pipeline.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Authentication & Identity**
- [ ] End-user đăng ký/đăng nhập bằng OTP email (qua Emailit, không password)
- [ ] JWT session cho dashboard (HttpOnly cookie)
- [ ] Admin role bootstrap từ `ADMIN_EMAIL` env (lamlai)
- [ ] Admin có thể deactivate user

**API Gateway**
- [ ] OpenAI-compatible `POST /v1/chat/completions` (Bearer `sk-...`)
- [ ] Anthropic-compatible `POST /v1/messages`
- [ ] Streaming SSE passthrough cho cả hai
- [ ] API key management: tạo, list, xoá, rotate, revoke
- [ ] API key SHA-256 hash stored in D1 (raw key chỉ hiển thị 1 lần khi tạo)
- [ ] Rate limit per API key
- [ ] Usage tracking: input tokens, output tokens, cost cents, model, timestamp

**RAG (Shared Knowledge Base)**
- [ ] Admin upload files (PDF, DOCX, MD, TXT) lên R2 qua dashboard
- [ ] Hệ thống chunk (~500 tokens, 50 overlap) + embed (Workers AI bge-base-en-v1.5, 768-dim) + upsert Vectorize
- [ ] Admin trigger reindex (manual + scheduled)
- [ ] Per-request: embed last user message → query Vectorize top-K → fetch chunks từ R2 → prepend context vào system message
- [ ] RAG config per request: top-K, threshold, prefix filter
- [ ] Hiển thị chunk sources trong response (citations) — optional cho v1

**Model Support**
- [ ] Cloudflare Workers AI native (Llama, Qwen, Mistral) cho embeddings + cheap inference
- [ ] OpenAI upstream (GPT-4o, GPT-4.1, o1, o3-mini…) qua API key của admin
- [ ] Anthropic upstream (Claude Sonnet, Haiku, Opus) qua API key của admin
- [ ] Per-model pricing table (USD cents per 1M tokens)
- [ ] Model deals/multipliers (vd: 4× usage cho model rẻ, free cho 1 số model)

**Billing & Payments**
- [ ] Pay-per-token: balance trừ dần theo usage
- [ ] User balance (USD cents nội bộ) hiển thị trên dashboard
- [ ] SePay QR topup: tạo QR với nội dung chuyển khoản có mã → webhook SePay xác nhận → cộng credits
- [ ] Topup history (pending/confirmed/rejected)
- [ ] VND ↔ USD cents conversion (configurable rate)
- [ ] Block request nếu balance không đủ (HTTP 402)
- [ ] Insufficient balance warning trước khi gọi

**Dashboard (User-facing)**
- [ ] Login page (OTP form, React island)
- [ ] Studio/overview (welcome, usage summary, quick links)
- [ ] Usage page (charts: tokens/day, cost/day, by model)
- [ ] Billing page (balance, topup history, topup CTA)
- [ ] API Keys page (create, list, revoke, copy-once)
- [ ] Profile page (avatar, email, joined date, change email)
- [ ] Playground (chat UI để test với model + RAG, không tính tiền hoặc có cảnh báo)
- [ ] Responsive: desktop-first, mobile acceptable

**Admin Dashboard**
- [ ] Users management (list, filter by status/role, deactivate/reactivate, view balance/usage)
- [ ] Transactions view (all topups, manual confirm/reject nếu webhook fail)
- [ ] KB management (upload files, list R2 objects, trigger reindex, view chunk count)
- [ ] Reindex trigger (manual button + status check)
- [ ] System stats (total users, total revenue, total tokens, model usage breakdown)

**Infrastructure & Observability**
- [ ] Single Cloudflare Worker serve cả API + dashboard (assets binding)
- [ ] D1 schema với migrations (users, api_keys, otp_codes, usage_logs, topup_records, rag_documents)
- [ ] Health endpoint `/health`
- [ ] Structured logging (hono/logger + ad-hoc console.error)
- [ ] One-shot deploy script (`deploy.sh`)
- [ ] Local dev với wrangler + .dev.vars

**Internationalization**
- [ ] Vietnamese-first: mặc định tiếng Việt cho dashboard (kèm English)
- [ ] VND là currency chính cho topup

### Out of Scope

- Social features (followers, activity streak, pinned taste packages) — defer to v2+; không phải core value cho B2D API platform
- OAuth (Google/GitHub login) — friction cao cho target dev VN; OTP email đủ
- Subscription plans (hàng tháng recurring) — pay-per-token đơn giản hơn cho v1
- Multi-tenant KB (mỗi user có KB riêng) — v1 chỉ shared corpus, multi-tenant là v2
- Real-time streaming UI trong playground — polling đủ cho v1
- Mobile native app — web-first
- Webhook cho user (outbound notification khi hết credits) — push trong dashboard là đủ
- Vectorize alternative (Pinecone, Weaviate) — Workers AI + Vectorize là combo Cloudflare-native
- Self-hosted model serving — chỉ dùng upstream API + Workers AI
- Multi-region deployment — single region Cloudflare đủ cho v1

## Context

**Domain:** B2D AI infrastructure, cạnh tranh trực tiếp với DeepSeek Platform, OpenRouter, Portkey, Together AI. Điểm khác biệt: VN-first (VND + tiếng Việt + SePay), shared RAG corpus do admin quản lý (giải đề xuất "knowledge-as-a-service"), chạy hoàn toàn trên Cloudflare edge (latency thấp cho user VN, cost thấp nhờ Workers AI free tier + AI Gateway caching).

**Technical environment:** Cloudflare Workers (workerd runtime), D1 (SQLite), R2 (object storage), Vectorize (vector index), Workers AI (inference + embeddings), AI Gateway (routing/caching/rate-limit). Frontend: Astro static SSG + React 19 islands. Backend: Hono 4. Monorepo: pnpm workspaces.

**Reference UI:** DeepSeek Platform dashboard (Studio, Usage, Billing, API Keys, Profile) — đã có ảnh tham khảo. Design system: IBM Carbon-inspired (square corners, Plex Sans, single blue accent) — đã có `DESIGN.md` với tokens.

**Prior work:** Repository có code `packages/api` + `packages/dashboard` từ nỗ lực trước; sẽ được dùng làm reference implementation và base để extend. Không treat là "validated" — plan từ vision mới.

## Constraints

- **Stack**: Cloudflare Workers only — không được dùng AWS/GCP/Azure (admin đã commit CF ecosystem)
- **Frontend**: Astro static SSG + React islands — không SSR runtime (cost), không client-side routing (giữ đơn giản)
- **Database**: D1 SQLite only — không Postgres, không KV, không Durable Objects cho v1 (trừ rate limit nếu cần)
- **Embeddings**: Workers AI `@cf/bge-base-en-v1.5` (768-dim) — đồng bộ với Vectorize
- **Admin email**: `ngoclam.lai@gmail.com` (bootstrap admin qua `ADMIN_EMAIL` env)
- **Auth**: Email OTP only (Emailit) — không password, không OAuth cho v1
- **Payment**: SePay QR only — không Stripe, không VNPay cho v1 (focus VN market)
- **Currency display**: VND cho user-facing, USD cents nội bộ để tính cost
- **Design system**: IBM Carbon tokens (đã có `DESIGN.md`) — không switch sang Tailwind/Material/Ant
- **Model access**: Admin cung cấp API key upstream (OpenAI, Anthropic) — user không tự thêm key

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cloudflare Workers only (D1, R2, Vectorize, Workers AI, AI Gateway) | Latency thấp cho VN user, cost thấp, single deploy unit, ecosystem nhất quán | — Pending |
| OpenAI + Anthropic compat API surface | Developer đã quen, dễ migrate từ OpenAI SDK, tận dụng existing client code | — Pending |
| Shared RAG corpus (admin-managed, single KB) | Đơn giản hơn multi-tenant, dùng cho use case "knowledge-as-a-service" (vd: docs sản phẩm, knowledge base công ty) | — Pending |
| Pay-per-token (không subscription) | Friction thấp cho dev VN, không cần recurring billing infra, dev control budget | — Pending |
| SePay QR + bank transfer cho topup | Phổ biến ở VN, không cần PCI compliance, fee thấp, real-time webhook | — Pending |
| OTP email (không password) | Giảm friction, không phải nhớ password, Emailit handle delivery | — Pending |
| Workers AI bge-base-en-v1.5 cho embeddings | Free tier, cùng edge → low latency, 768-dim đồng bộ Vectorize | — Pending |
| Astro static SSG + React islands | Dashboard không cần SSR, hydrate chỉ 4 islands (OTP form, charts, admin tables), bundle nhỏ | — Pending |
| Vietnamese-first UI | Target audience là dev VN, VND là currency chính, tiếng Việt là default | — Pending |
| IBM Carbon design tokens (đã có DESIGN.md) | Square corners, single blue accent, enterprise gravitas; đã có tokens, không redesign | — Pending |

---

*Last updated: 2026-06-08 after initialization*
