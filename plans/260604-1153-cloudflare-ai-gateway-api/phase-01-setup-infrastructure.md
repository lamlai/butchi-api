---
phase: 1
title: "Setup Infrastructure"
status: pending
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Setup Infrastructure

## Overview

Khởi tạo project structure với monorepo chứa 2 packages: `api` (Cloudflare Workers + Hono) và `dashboard` (Astro SSR). Setup Wrangler config, D1 binding, R2 binding, AI Gateway binding.

## Requirements

- Functional: Monorepo hoạt động với 2 packages, dev server chạy được
- Non-functional: TypeScript strict mode, ESLint, Prettier

## Architecture

```
butchi-api/
├── packages/
│   ├── api/                    # Cloudflare Worker (Hono)
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point
│   │   │   ├── routes/         # API routes
│   │   │   ├── middleware/     # Auth, rate-limit, logging
│   │   │   ├── services/      # Business logic
│   │   │   └── db/            # D1 schema & queries
│   │   ├── wrangler.toml      # Worker config
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── dashboard/              # Astro SSR
│       ├── src/
│       │   ├── pages/         # Astro pages
│       │   ├── components/    # UI components (Carbon)
│       │   └── layouts/       # Layouts
│       ├── astro.config.mjs
│       ├── package.json
│       └── tsconfig.json
├── package.json                # Root workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .dev.vars                   # Local env vars
```

## Related Code Files

- Create: `package.json` (root workspace)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/wrangler.toml`
- Create: `packages/api/src/index.ts`
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/astro.config.mjs`
- Create: `packages/dashboard/src/pages/index.astro`

## Implementation Steps

1. Init root workspace với pnpm
2. Create `packages/api` — Hono + Cloudflare Workers template
3. Configure `wrangler.toml` với D1, R2, AI Gateway bindings
4. Create `packages/dashboard` — Astro SSR + Cloudflare adapter
5. Setup shared TypeScript config
6. Verify `pnpm dev` chạy được cả 2 packages
7. Create `.dev.vars` template cho local development

## Success Criteria

- [x] `pnpm install` thành công
- [x] `pnpm --filter api dev` khởi động Hono worker trên localhost
- [x] `pnpm --filter dashboard dev` khởi động Astro dev server
- [x] Wrangler bindings (D1, R2, AI) configured trong wrangler.toml
- [x] TypeScript compile không lỗi (api + dashboard)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Wrangler version incompatibility | Pin version trong package.json |
| D1/R2 binding không work local | Dùng `--local` flag với miniflare |
