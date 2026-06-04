---
type: brainstorm
date: 2026-06-04
slug: cloudflare-ai-gateway-api
---

# Brainstorm Report: Cloudflare AI Gateway API Layer

## Problem Statement

Xây dựng một API layer cung cấp endpoints tương thích OpenAI và Anthropic cho người dùng cuối, sử dụng:
- RAG data lưu trên Cloudflare R2
- Cloudflare AI Gateway làm proxy layer
- User dashboard với các trang: Profile, Usage, Billing, API Keys

## Tech Stack đã thống nhất

| Component | Choice | Lý do |
|-----------|--------|-------|
| Backend API | Cloudflare Workers (Hono) | Native Cloudflare, serverless, zero-config với R2/D1/AI Gateway |
| Database | Cloudflare D1 (SQLite) | Native ecosystem, zero-config, serverless |
| Frontend | Astro SSR + Cloudflare Pages | Performance tối ưu, island architecture |
| Auth | Email OTP (Cloudflare Email Workers) | Đơn giản, không phụ thuộc third-party |
| Billing | Pay-per-token (usage-based) | Công bằng, transparent |
| RAG Storage | Cloudflare R2 | Đã có sẵn data |
| AI Gateway | Cloudflare AI Gateway | Native proxy, logging, rate limiting |
| Design System | IBM Carbon (từ DESIGN.md) | Đã có spec |

## Architecture Overview

```
User Request (OpenAI/Anthropic compatible)
    │
    ▼
┌─────────────────────────────┐
│  Cloudflare Worker (Hono)   │
│  - Auth (API Key validate)  │
│  - Rate limiting            │
│  - Usage tracking           │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  RAG Layer                  │
│  - Query R2 for context     │
│  - Inject into prompt       │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Cloudflare AI Gateway      │
│  - Forward to LLM provider  │
│  - Logging & analytics      │
└─────────────┬───────────────┘
              │
              ▼
        LLM Response
              │
              ▼
┌─────────────────────────────┐
│  Worker (post-process)      │
│  - Token counting           │
│  - Usage recording (D1)     │
│  - Response formatting      │
└─────────────┬───────────────┘
              │
              ▼
        User Response
```

## Dashboard Architecture

```
┌─────────────────────────────┐
│  Astro SSR (Cloudflare Pages)│
│  - Profile page             │
│  - Usage page (charts)      │
│  - Billing page             │
│  - API Keys page            │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Backend API (Hono Worker)  │
│  - /api/auth/*              │
│  - /api/user/*              │
│  - /api/usage/*             │
│  - /api/billing/*           │
│  - /api/keys/*              │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Cloudflare D1              │
│  - users                    │
│  - api_keys                 │
│  - usage_logs               │
│  - billing_records          │
│  - otp_codes                │
└─────────────────────────────┘
```

## RAG Flow Chi tiết

1. User gửi request (OpenAI/Anthropic format) kèm API key
2. Worker validate API key từ D1
3. Worker parse request, extract query
4. Query R2 để lấy relevant context (vector search hoặc keyword matching)
5. Inject context vào system prompt / user message
6. Forward enriched request qua Cloudflare AI Gateway
7. Nhận response từ LLM
8. Count tokens (input + output)
9. Log usage vào D1
10. Trả response cho user (format tương thích OpenAI/Anthropic)

## Database Schema (Draft)

- **users**: id, email, name, created_at, updated_at
- **otp_codes**: id, user_id, code, expires_at, used
- **api_keys**: id, user_id, key_hash, name, created_at, last_used, revoked
- **usage_logs**: id, user_id, api_key_id, model, input_tokens, output_tokens, cost, created_at
- **billing_records**: id, user_id, amount, period_start, period_end, status, paid_at

## API Endpoints (Draft)

### Public API (OpenAI/Anthropic compatible)
- `POST /v1/chat/completions` — OpenAI compatible
- `POST /v1/messages` — Anthropic compatible

### Dashboard API
- `POST /api/auth/otp/send` — Gửi OTP
- `POST /api/auth/otp/verify` — Verify OTP
- `GET /api/user/profile` — Lấy profile
- `PUT /api/user/profile` — Update profile
- `GET /api/usage` — Lấy usage stats
- `GET /api/billing` — Lấy billing info
- `GET /api/keys` — List API keys
- `POST /api/keys` — Create API key
- `DELETE /api/keys/:id` — Revoke API key

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| D1 performance limits | Caching layer, batch writes |
| R2 RAG query speed | Pre-indexed data, caching |
| OTP delivery reliability | Retry mechanism, rate limiting |
| Token counting accuracy | Use tiktoken hoặc provider-specific counting |
| API key security | Hash keys, never store plaintext |

## Success Criteria

- [ ] OpenAI-compatible endpoint hoạt động
- [ ] Anthropic-compatible endpoint hoạt động
- [ ] RAG injection chính xác
- [ ] Dashboard login via OTP
- [ ] API key CRUD
- [ ] Usage tracking realtime
- [ ] Billing calculation chính xác
- [ ] Deploy trên Cloudflare (Workers + Pages)

## Next Steps

Chuyển sang `/ck:plan` để tạo implementation plan chi tiết theo phases.
