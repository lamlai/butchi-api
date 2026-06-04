---
phase: 3
title: "API Gateway Core"
status: pending
priority: P1
effort: "4h"
dependencies: [2]
---

# Phase 3: API Gateway Core

## Overview

Implement OpenAI-compatible và Anthropic-compatible API endpoints. Worker nhận request, validate API key, forward qua Cloudflare AI Gateway, trả response đúng format.

## Requirements

- Functional: `POST /v1/chat/completions` (OpenAI), `POST /v1/messages` (Anthropic)
- Non-functional: Latency < 100ms overhead, streaming support

## Architecture

```
Request Flow:
1. User sends request with API key in header
2. Middleware validates API key (hash lookup in D1)
3. Parse request body (OpenAI or Anthropic format)
4. Forward to Cloudflare AI Gateway
5. Stream/collect response
6. Count tokens (input + output)
7. Log usage to D1
8. Return response in original format
```

## Related Code Files

- Create: `packages/api/src/routes/openai-routes.ts`
- Create: `packages/api/src/routes/anthropic-routes.ts`
- Create: `packages/api/src/services/gateway-service.ts`
- Create: `packages/api/src/services/token-counter-service.ts`
- Create: `packages/api/src/middleware/api-key-middleware.ts`
- Create: `packages/api/src/middleware/rate-limit-middleware.ts`
- Create: `packages/api/src/types/openai-types.ts`
- Create: `packages/api/src/types/anthropic-types.ts`

## Implementation Steps

1. Define TypeScript types cho OpenAI request/response format
2. Define TypeScript types cho Anthropic request/response format
3. Implement API key middleware:
   - Extract key from `Authorization: Bearer sk-xxx` header
   - Hash key, lookup in D1 `api_keys` table
   - Reject if not found or revoked
   - Attach user_id + api_key_id to context
4. Implement rate limit middleware (per API key):
   - Sliding window counter in D1 hoặc Workers KV
   - Default: 60 requests/minute
5. Implement gateway service:
   - Build request for Cloudflare AI Gateway
   - Handle streaming (SSE) responses
   - Handle non-streaming responses
6. Implement token counter service:
   - Count input tokens from request
   - Count output tokens from response
   - Model-specific pricing lookup
7. Create OpenAI-compatible route `POST /v1/chat/completions`:
   - Parse OpenAI format request
   - Call gateway service
   - Return OpenAI format response
8. Create Anthropic-compatible route `POST /v1/messages`:
   - Parse Anthropic format request
   - Transform to gateway format
   - Call gateway service
   - Return Anthropic format response
9. Log usage after each successful request

## Success Criteria

- [x] `POST /v1/chat/completions` trả response đúng OpenAI format
- [x] `POST /v1/messages` trả response đúng Anthropic format
- [x] Streaming (SSE) hoạt động cho cả 2 endpoints
- [x] Invalid API key → 401 Unauthorized
- [x] Rate limit exceeded → 429 Too Many Requests
- [x] Usage logged vào D1 sau mỗi request
- [x] Token count chính xác (±5% tolerance)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| AI Gateway timeout | Configurable timeout, retry logic |
| Streaming disconnect | Graceful error handling, partial usage logging |
| Token counting inaccuracy | Use provider's token count from response headers when available |
| Rate limit D1 write contention | Batch writes, or use Workers KV for counters |
