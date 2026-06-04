---
phase: 6
title: "Billing & Usage"
status: pending
priority: P2
effort: "4h"
dependencies: [3, 5]
---

# Phase 6: Billing & Usage

## Overview

Implement usage tracking, token counting, cost calculation, billing APIs, và SePay QR Pay integration cho nạp tiền. Pay-per-token model: mỗi request log input/output tokens + cost. User nạp credit qua SePay QR → webhook confirm → cộng balance.

## Requirements

- Functional: Realtime usage tracking, cost calculation per model, SePay QR nạp tiền, webhook auto-confirm
- Non-functional: Accurate token counting (±5%), no data loss on failures, webhook idempotent

## Architecture

```
Billing Flow:
1. Request completes → token count extracted
2. Cost calculated based on model pricing table
3. Usage log inserted into D1, balance deducted
4. Dashboard queries aggregated usage stats

Top-up Flow (SePay):
1. User clicks "Nạp tiền" → select amount
2. Backend generates SePay QR payment request
3. User scans QR → pays via bank app
4. SePay sends webhook → Worker verifies signature
5. Credit added to user balance in D1

Pricing Table (configurable):
- gpt-4o: input $2.50/1M, output $10.00/1M
- gpt-4o-mini: input $0.15/1M, output $0.60/1M
- @cf/meta/llama-3.3-70b-instruct-fp8-fast: input $0.00/1M, output $0.00/1M (Workers AI free tier / included)
```

## Related Code Files

- Create: `packages/api/src/services/billing-service.ts`
- Create: `packages/api/src/services/usage-service.ts`
- Create: `packages/api/src/services/sepay-service.ts`
- Create: `packages/api/src/routes/usage-routes.ts`
- Create: `packages/api/src/routes/billing-routes.ts`
- Create: `packages/api/src/routes/webhook-routes.ts`
- Create: `packages/api/src/config/pricing-config.ts`

## Implementation Steps

1. Create pricing config:
   - Model → price per 1M input/output tokens
   - Configurable via env vars or D1 config table
   - Workers AI models: free or heavily discounted
2. Add `balance_cents` column to users table (or separate wallet table):
   ```sql
   ALTER TABLE users ADD COLUMN balance_cents INTEGER DEFAULT 0;
   
   CREATE TABLE topup_records (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id),
     amount_cents INTEGER NOT NULL,
     sepay_transaction_id TEXT UNIQUE,
     status TEXT DEFAULT 'pending',
     created_at TEXT DEFAULT (datetime('now')),
     confirmed_at TEXT
   );
   ```
3. Implement usage service:
   - `logUsage(userId, apiKeyId, model, inputTokens, outputTokens)` → insert D1 + deduct balance
   - `getUsageStats(userId, period)` → aggregate query
   - `getUsageHistory(userId, page, limit)` → paginated history
   - `getDailyUsage(userId, days)` → daily aggregation for charts
4. Implement billing service:
   - `calculateCost(model, inputTokens, outputTokens)` → cost in cents
   - `getBalance(userId)` → current balance
   - `addCredit(userId, amountCents, transactionId)` → top-up
   - `checkSufficientBalance(userId, estimatedCost)` → pre-flight check
5. Implement SePay service:
   - `createQRPayment(userId, amountVND)` → generate QR code URL
   - `verifyWebhookSignature(payload, signature)` → validate
   - `processWebhook(payload)` → confirm payment, add credit
6. Create usage routes (protected by auth middleware):
   - `GET /api/usage` → usage stats (total tokens, total cost, current period)
   - `GET /api/usage/history` → paginated usage log
   - `GET /api/usage/daily` → daily aggregation (for chart)
7. Create billing routes (protected by auth middleware):
   - `GET /api/billing` → current balance + billing info
   - `GET /api/billing/history` → topup history
   - `POST /api/billing/topup` → create SePay QR payment
8. Create webhook route (public, signature-verified):
   - `POST /api/webhooks/sepay` → receive payment confirmation
9. Integrate balance check into API gateway flow:
   - Before forwarding request, check user has sufficient balance
   - If insufficient → 402 Payment Required
   - After response, deduct actual cost from balance

## Success Criteria

- [x] Every API request logs usage (model, tokens, cost) to D1
- [x] Balance deducted after each successful API call
- [x] Insufficient balance → 402 Payment Required
- [x] `POST /api/billing/topup` returns SePay QR code
- [x] SePay webhook correctly adds credit to user balance
- [x] Webhook is idempotent (duplicate calls don't double-credit)
- [x] `GET /api/usage/daily` returns daily data for chart rendering
- [x] Usage logging doesn't add > 10ms to response time

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| D1 write failures losing usage data | Queue failed writes for retry (Queues) |
| SePay webhook replay attack | Verify signature + idempotency key (transaction_id UNIQUE) |
| Race condition on balance deduction | D1 transaction or optimistic locking |
| Token count mismatch with provider | Use provider's usage header when available |
| VND to USD conversion for pricing | Store all costs in VND cents, configure pricing in VND |
