---
phase: 2
title: "Database Schema & Auth"
status: pending
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Database Schema & Auth

## Overview

Thiết kế D1 schema cho users, OTP codes, API keys, usage logs, billing. Implement Email OTP authentication flow với Cloudflare Email Workers.

## Requirements

- Functional: User đăng ký/đăng nhập bằng email OTP, quản lý session bằng JWT
- Non-functional: OTP expires sau 5 phút, rate limit 3 OTP/email/10min

## Architecture

```
Login Flow:
1. POST /api/auth/otp/send {email}
   → Generate 6-digit OTP
   → Store in D1 (expires 5min)
   → Send via Cloudflare Email Worker

2. POST /api/auth/otp/verify {email, code}
   → Validate OTP from D1
   → Create/get user
   → Return JWT token

3. All protected routes:
   → Middleware validates JWT
   → Attaches user to request context
```

## Related Code Files

- Create: `packages/api/src/db/schema.sql`
- Create: `packages/api/src/db/migrations/001-initial.sql`
- Create: `packages/api/src/middleware/auth-middleware.ts`
- Create: `packages/api/src/routes/auth-routes.ts`
- Create: `packages/api/src/services/otp-service.ts`
- Create: `packages/api/src/services/jwt-service.ts`
- Create: `packages/api/src/services/email-service.ts`

## Implementation Steps

1. Design D1 schema (SQL migrations)
2. Create migration file `001-initial.sql`:
   ```sql
   CREATE TABLE users (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     name TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now'))
   );

   CREATE TABLE otp_codes (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL,
     code TEXT NOT NULL,
     expires_at TEXT NOT NULL,
     used INTEGER DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now'))
   );

   CREATE TABLE api_keys (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id),
     key_hash TEXT NOT NULL,
     key_prefix TEXT NOT NULL,
     name TEXT NOT NULL,
     last_used_at TEXT,
     revoked INTEGER DEFAULT 0,
     created_at TEXT DEFAULT (datetime('now'))
   );

   CREATE TABLE usage_logs (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id),
     api_key_id TEXT NOT NULL REFERENCES api_keys(id),
     model TEXT NOT NULL,
     input_tokens INTEGER NOT NULL,
     output_tokens INTEGER NOT NULL,
     cost_cents INTEGER NOT NULL,
     created_at TEXT DEFAULT (datetime('now'))
   );

   CREATE TABLE billing_records (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id),
     amount_cents INTEGER NOT NULL,
     period_start TEXT NOT NULL,
     period_end TEXT NOT NULL,
     status TEXT DEFAULT 'pending',
     created_at TEXT DEFAULT (datetime('now'))
   );
   ```
3. Implement OTP service (generate, store, validate, expire)
4. Implement Email service (send OTP via Cloudflare Email Workers)
5. Implement JWT service (sign, verify, refresh)
6. Implement auth middleware (extract JWT, validate, attach user)
7. Create auth routes (`/api/auth/otp/send`, `/api/auth/otp/verify`)
8. Apply D1 migration via wrangler

## Success Criteria

- [x] D1 migration runs successfully
- [x] POST `/api/auth/otp/send` sends OTP email
- [x] POST `/api/auth/otp/verify` returns valid JWT
- [x] Protected routes reject requests without valid JWT
- [x] OTP expires after 5 minutes
- [x] Rate limiting: max 3 OTP requests per email per 10 minutes

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Email delivery delay | Show "check spam" message, allow resend after 60s |
| OTP brute force | Rate limit + account lockout after 5 failed attempts |
| JWT token leak | Short expiry (1h), refresh token pattern |
