---
phase: 5
title: "Dashboard Frontend"
status: pending
priority: P2
effort: "6h"
dependencies: [2, 3]
---

# Phase 5: Dashboard Frontend

## Overview

Xây dựng user dashboard bằng Astro SSR trên Cloudflare Pages. 4 trang chính: Profile, Usage, Billing, API Keys. Sử dụng IBM Carbon Design System (từ DESIGN.md).

## Requirements

- Functional: Login OTP, xem profile, xem usage charts, xem billing, CRUD API keys
- Non-functional: First paint < 1s, accessible (WCAG 2.1 AA), responsive

## Architecture

```
Dashboard Pages:
├── / (redirect to /dashboard)
├── /login (OTP form)
├── /dashboard
│   ├── /profile    — Edit name, email display
│   ├── /usage      — Token usage charts, history table
│   ├── /billing    — Current balance, payment history
│   └── /api-keys   — List, create, revoke keys
```

Component Strategy: Astro pages + React islands cho interactive components (charts, forms).

## Related Code Files

- Create: `packages/dashboard/src/pages/index.astro`
- Create: `packages/dashboard/src/pages/login.astro`
- Create: `packages/dashboard/src/pages/dashboard/profile.astro`
- Create: `packages/dashboard/src/pages/dashboard/usage.astro`
- Create: `packages/dashboard/src/pages/dashboard/billing.astro`
- Create: `packages/dashboard/src/pages/dashboard/api-keys.astro`
- Create: `packages/dashboard/src/layouts/dashboard-layout.astro`
- Create: `packages/dashboard/src/layouts/auth-layout.astro`
- Create: `packages/dashboard/src/components/otp-form.tsx`
- Create: `packages/dashboard/src/components/usage-chart.tsx`
- Create: `packages/dashboard/src/components/api-key-list.tsx`
- Create: `packages/dashboard/src/components/api-key-create-modal.tsx`
- Create: `packages/dashboard/src/lib/api-client.ts`
- Create: `packages/dashboard/src/styles/tokens.css`

## Implementation Steps

1. Setup Astro với Cloudflare adapter + React integration
2. Create design tokens CSS từ DESIGN.md (colors, typography, spacing)
3. Create layouts:
   - `auth-layout.astro` — minimal, centered card
   - `dashboard-layout.astro` — sidebar nav + main content
4. Create login page:
   - Email input form
   - OTP verification form (React island: `otp-form.tsx`)
   - Store JWT in httpOnly cookie
5. Create API client (`lib/api-client.ts`):
   - Wrapper cho fetch calls to backend API
   - Auto-attach JWT from cookie
   - Handle 401 → redirect to login
6. Create Profile page:
   - Display email, name
   - Edit name form
7. Create Usage page:
   - Usage chart (React island: `usage-chart.tsx`) — daily token usage
   - Usage history table — model, tokens, cost, timestamp
8. Create Billing page:
   - Current balance display
   - Payment history table
   - (Future: add payment method)
9. Create API Keys page:
   - List existing keys (prefix only, masked)
   - Create new key modal (React island)
   - Copy key (shown only once on creation)
   - Revoke key button with confirmation
10. Setup SSR middleware for auth check (redirect unauthenticated to /login)

## Success Criteria

- [x] Login via OTP works end-to-end
- [x] Profile page displays and edits user info
- [x] Usage page shows token consumption chart + table
- [x] Billing page shows balance and history
- [x] API Keys page: create, list, revoke keys
- [ ] Responsive trên mobile/tablet/desktop (cần responsive review)
- [x] Design tokens match IBM Carbon (tokens.css)
- [ ] Deploy thành công trên Cloudflare Pages (chưa deploy)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Astro + Cloudflare Pages SSR issues | Test early, fallback to static + client fetch |
| React hydration mismatch | Keep islands minimal, use client:only directive |
| JWT cookie security | httpOnly, secure, sameSite=strict, short expiry |
| Chart library bundle size | Lazy load chart component, use lightweight lib (Chart.js or uPlot) |
