---
title: "Cloudflare AI Gateway API - Butchi API"
description: "API layer cung cấp endpoints tương thích OpenAI/Anthropic cho người dùng cuối, sử dụng RAG data trên R2 + Cloudflare AI Gateway + User Dashboard"
status: completed
priority: P1
branch: ""
tags: [cloudflare, ai-gateway, rag, hono, astro, d1]
blockedBy: []
blocks: []
created: "2026-06-04T04:53:39.373Z"
createdBy: "ck:plan"
source: skill
---

# Cloudflare AI Gateway API - Butchi API

## Overview

Xây dựng API layer serverless trên Cloudflare ecosystem:
- **Backend**: Cloudflare Workers (Hono) — proxy API tương thích OpenAI/Anthropic
- **Database**: Cloudflare D1 — users, API keys, usage logs, billing
- **Frontend**: Astro SSR trên Cloudflare Pages — dashboard (Profile, Usage, Billing, API Keys)
- **Auth**: Email OTP via Cloudflare Email Workers
- **RAG**: Query R2 → inject context → forward qua AI Gateway
- **Billing**: Pay-per-token (usage-based)

## Architecture

```
User Request (OpenAI/Anthropic compatible)
    │
    ▼
┌─────────────────────────────┐
│  Cloudflare Worker (Hono)   │
│  - API Key validation       │
│  - Rate limiting            │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  RAG Layer (R2 query)       │
│  - Context injection        │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Cloudflare AI Gateway      │
│  - Forward to LLM           │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Post-process               │
│  - Token counting           │
│  - Usage logging (D1)       │
└─────────────────────────────┘
```

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Setup Infrastructure](./phase-01-setup-infrastructure.md) | Complete | 2h |
| 2 | [Database Schema & Auth](./phase-02-database-schema-auth.md) | Complete | 4h |
| 3 | [API Gateway Core](./phase-03-api-gateway-core.md) | Complete | 4h |
| 4 | [RAG Integration](./phase-04-rag-integration.md) | Complete | 3h |
| 5 | [Dashboard Frontend](./phase-05-dashboard-frontend.md) | Complete | 6h |
| 6 | [Billing & Usage](./phase-06-billing-usage.md) | Complete | 3h |
| 7 | [Testing & Deploy](./phase-07-testing-deploy.md) | Partial | 3h | |

## Dependencies

- Cloudflare account với R2, D1, Workers, Pages, AI Gateway đã setup
- RAG data đã có sẵn trên R2
- Domain đã trỏ về Cloudflare

## Key Decisions

- Hono framework cho Workers (lightweight, fast, middleware ecosystem)
- D1 cho database (native, zero-config, serverless)
- Astro SSR cho dashboard (performance, island architecture, Carbon design)
- Email OTP auth (simple, no third-party dependency)
- Pay-per-token billing (transparent, fair)
- Vector search RAG via Cloudflare Vectorize + Workers AI embedding (bge-base-en-v1.5)
- R2 data: raw text files, flat bucket, prefix-based structure
- SePay QR Pay cho nạp tiền (webhook auto-confirm)
- Models: OpenAI (gpt-4o, gpt-4o-mini) + Workers AI (Llama 3.3 70B)
- Scale target: trung bình (100-1000 users, 1000-10000 requests/ngày)
