# Butchi API -- System Architecture

## Component Diagram

```
packages/api (Hono Worker)
    /v1/chat/completions, /v1/messages   \   Services:
    /api/auth/*, /api/profile/*           |   billing, gateway, jwt,
    /api/keys/*, /api/usage/*    REST --->+   otp, rag, embed, sepay,
    /api/billing/*, /api/webhooks/*       |   usage, email, context-builder
    /api/admin/*                          /
       |        |              |         |
      D1 DB  Vectorize        R2      AI Gateway
  (users,     (embed          (PDF   (upstream cache)
   otp_codes,  search,        docs)
   api_keys,   RAG index)
   usage_logs,
   billing,
   topups)

packages/dashboard (Astro SSR on Pages)
    /login --> otp-form (React island)
    /dashboard/{profile,usage,billing,api-keys}
    API client --> packages/api
```

## Request Flows

**Gateway** (OpenAI/Anthropic): API Key middleware (SHA-256) -> rate limit (in-mem 60/min) -> billing check -> RAG (Vectorize) -> gateway proxy -> usage log

**Dashboard:** Browser -> Astro SSR -> API call with JWT Bearer -> JWT middleware -> route handler -> D1 query -> JSON -> rendered HTML

**Auth:** `POST /api/auth/otp/send` (generate code, store D1, email) -> `POST /api/auth/otp/verify` (validate, upsert user, return JWT)

**SePay webhook:** bank transfer notification -> match pending topup record -> confirm + add to balance_cents

## Key Data

- **API keys:** stored as SHA-256 hash with `sk-` prefix, never plaintext
- **Billing:** balance_cents on user row, deducted per request, topups via SePay
- **RAG pipeline:** upload PDF to R2 -> indexer -> Workers AI embedding -> Vectorize store
