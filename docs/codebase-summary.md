# Butchi API -- Codebase Summary

## Overview

Monorepo (pnpm workspaces) for an AI gateway API and customer dashboard. Two packages under `packages/`: `api` and `dashboard`.

## Packages

### `packages/api` -- Hono on Cloudflare Workers

- **Framework:** Hono v4, deployed as a Cloudflare Worker via wrangler
- **Entry:** `src/index.ts` -- mounts all route groups on the Hono app
- **Routing:** Grouped under path prefixes:
  - `/v1/chat/completions` (OpenAI-compatible)
  - `/v1/messages` (Anthropic-compatible)
  - `/api/auth/otp/send`, `/api/auth/otp/verify`
  - `/api/admin/*`
  - `/api/profile/*`, `/api/keys/*`, `/api/usage/*`, `/api/billing/*`
  - `/api/webhooks/sepay`
- **Middleware stack** (applied per-route-group):
  - JWT auth (`auth-middleware.ts`) for dashboard API routes
  - API key auth (`api-key-middleware.ts`, SHA-256 hashed, `sk-` prefix) for gateway routes
  - Rate limiting (`rate-limit-middleware.ts`, in-memory sliding window, 60 req/min)
- **Services** (15 files in `src/services/`): billing, context-builder, email (OTP), embedding, gateway (upstream proxy), indexer, JWT, OTP, R2 storage, RAG, SePay webhook, token-counter, usage, vectorize
- **Database:** Cloudflare D1 -- tables: `users`, `otp_codes`, `api_keys`, `usage_logs`, `billing_records`, `topup_records` (schema in `src/db/schema.sql`)
- **Integrations:** Workers AI (embeddings, inference), Vectorize (RAG index), R2 (document storage), AI Gateway (caching/rate-limit), SePay (bank transfer webhooks)
- **Tests:** 4 test files in `src/services/__tests__/` covering billing, JWT, OTP, token-counter services

### `packages/dashboard` -- Astro SSR on Cloudflare Pages

- **Adapter:** `@astrojs/cloudflare` with server output
- **UI:** Astro pages + React islands (`otp-form.tsx`, `usage-chart.tsx`)
- **Pages:**
  - `/login` -- OTP auth form
  - `/` (index) -- landing/redirect
  - `/dashboard/profile`, `/dashboard/usage`, `/dashboard/billing`, `/dashboard/api-keys`
- **Layouts:** `auth-layout.astro`, `dashboard-layout.astro`
- **API client:** `src/lib/api-client.ts` -- fetches against the API Worker
- **Styles:** `src/styles/tokens.css` -- design token variables

## Infrastructure

- **Cloudflare bindings:** D1 (DB), R2 (RAG storage), Vectorize (index), Workers AI, AI Gateway
- **Env vars:** `JWT_SECRET`, `OTP_EMAIL_FROM`, `ENVIRONMENT`, `SEPAY_*` vars
- **Deploy:** `deploy.sh` at repo root; preview via `wrangler dev --local`
