---
phase: 7
title: "Testing & Deploy"
status: pending
priority: P2
effort: "3h"
dependencies: [4, 5, 6]
---

# Phase 7: Testing & Deploy

## Overview

Vitest unit tests cho core services, integration tests cho API endpoints, deploy API lên Cloudflare Workers và dashboard lên Cloudflare Pages.

## Requirements

- Functional: All API endpoints tested, deploy pipeline hoạt động
- Non-functional: Test coverage > 80% cho services, deploy < 2 minutes

## Architecture

```
Testing Strategy:
├── Unit Tests (Vitest)
│   ├── services/otp-service.test.ts
│   ├── services/jwt-service.test.ts
│   ├── services/gateway-service.test.ts
│   ├── services/rag-service.test.ts
│   ├── services/billing-service.test.ts
│   └── services/token-counter-service.test.ts
├── Integration Tests (Vitest + miniflare)
│   ├── routes/auth-routes.test.ts
│   ├── routes/openai-routes.test.ts
│   ├── routes/anthropic-routes.test.ts
│   └── routes/usage-routes.test.ts
└── E2E (manual or Playwright for dashboard)

Deploy:
├── API → Cloudflare Workers (wrangler deploy)
└── Dashboard → Cloudflare Pages (wrangler pages deploy)
```

## Related Code Files

- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/src/services/__tests__/otp-service.test.ts`
- Create: `packages/api/src/services/__tests__/jwt-service.test.ts`
- Create: `packages/api/src/services/__tests__/gateway-service.test.ts`
- Create: `packages/api/src/services/__tests__/rag-service.test.ts`
- Create: `packages/api/src/services/__tests__/billing-service.test.ts`
- Create: `packages/api/src/routes/__tests__/auth-routes.test.ts`
- Create: `packages/api/src/routes/__tests__/openai-routes.test.ts`
- Modify: `packages/api/package.json` (add test scripts)
- Create: `wrangler-deploy.sh` (deploy script)

## Implementation Steps

1. Setup Vitest cho packages/api:
   - Install vitest, @cloudflare/vitest-pool-workers
   - Configure vitest.config.ts với miniflare environment
2. Write unit tests cho core services:
   - OTP service: generate, validate, expire
   - JWT service: sign, verify, expired token
   - Token counter: accurate counting cho various inputs
   - Billing service: cost calculation
   - RAG service: context building, token budget
3. Write integration tests cho API routes:
   - Auth flow: send OTP → verify → get JWT
   - OpenAI endpoint: valid request → response format
   - Anthropic endpoint: valid request → response format
   - Usage endpoint: returns correct aggregated data
   - API key CRUD: create, list, revoke
4. Setup deploy pipeline:
   - `packages/api`: `wrangler deploy`
   - `packages/dashboard`: `wrangler pages deploy`
   - D1 migrations: `wrangler d1 migrations apply`
5. Create deploy script (`deploy.sh`):
   ```bash
   # Apply D1 migrations
   pnpm --filter api exec wrangler d1 migrations apply butchi-db --remote
   # Deploy API worker
   pnpm --filter api exec wrangler deploy
   # Build & deploy dashboard
   pnpm --filter dashboard build
   pnpm --filter dashboard exec wrangler pages deploy dist
   ```
6. Verify production deployment:
   - API endpoints respond correctly
   - Dashboard loads and auth works
   - D1 queries execute successfully
   - R2 access works
   - AI Gateway forwards requests

## Success Criteria

- [x] All unit tests pass (20/20)
- [ ] All integration tests pass (miniflare integration tests chưa viết)
- [ ] Test coverage > 80% cho services (chưa đo)
- [ ] API Worker deployed successfully (chưa deploy)
- [ ] Dashboard Pages deployed successfully (chưa deploy)
- [ ] D1 migrations applied to production (chưa deploy)
- [ ] End-to-end flow works (chưa test end-to-end)
- [x] Deploy script created (deploy.sh)
- [x] D1 migrations applied to production
- [x] API Worker deployed: https://butchi-api.ngoclamlai.workers.dev/
- [x] Dashboard Pages deployed: https://butchi-dashboard.pages.dev/

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Miniflare env differs from production | Test on staging worker before prod |
| D1 migration fails on production | Backup D1 before migration, test on preview first |
| AI Gateway config mismatch | Verify gateway ID in wrangler.toml matches Cloudflare dashboard |
| Pages build fails | Pin dependencies, test build locally first |
