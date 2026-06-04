# Technology Stack

**Analysis Date:** 2026-06-04

## Languages

**Primary:**
- TypeScript 5.6 (strict mode, ES2022 target) — all source code in `packages/api/src/` and `packages/dashboard/src/`
- SQL (SQLite dialect for D1) — schema/migrations in `packages/api/src/db/schema.sql`, `packages/api/migrations/`

**Secondary:**
- Astro server markup (`.astro` files) — layouts/pages in `packages/dashboard/src/pages/`, `packages/dashboard/src/layouts/`
- TSX (React 19) — interactive islands in `packages/dashboard/src/components/`
- Hono JSX (`hono/jsx` JSX import source) — declared in `packages/api/tsconfig.json` (available but not currently used in components)

## Runtime

**Environment:**
- Cloudflare Workers (workerd) — primary runtime for `packages/api` via `wrangler.toml` (`compatibility_date = "2024-10-01"`, `compatibility_flags = ["nodejs_compat"]`)
- Node.js `>= 22` — declared in `engines` at `package.json` for local dev/test
- Browser (ES2022 output, ES modules) — `packages/dashboard` ships static assets

**Package Manager:**
- pnpm 9+ workspaces — `pnpm-workspace.yaml` at repo root, `allowBuilds: esbuild, sharp, workerd`
- Lockfile: `pnpm-lock.yaml` present (committed)

## Frameworks

**Core:**
- Hono 4.6.0 — HTTP router in `packages/api/src/index.ts` (`new Hono<{ Bindings: Bindings }>()`)
- Astro 4.16.0 (static / SSG output, `output: "static"`) — `packages/dashboard/astro.config.mjs`
- React 19.2.7 + React-DOM 19.2.7 — client-side islands

**Integrations / Adapters:**
- `@astrojs/react` 3.6.0 — React island integration in `packages/dashboard/astro.config.mjs`
- `@astrojs/check` 0.9.9 — typecheck script (`astro check`) in `packages/dashboard/package.json`

**Testing:**
- Vitest 3.0.0 with `@cloudflare/vitest-pool-workers` 0.7.0 — `packages/api/vitest.config.ts`, runs in `node` env (not the worker pool currently)
- Test files: `packages/api/src/services/__tests__/*.test.ts` (4 files: `billing-service`, `jwt-service`, `otp-service`, `token-counter-service`)

**Build/Dev:**
- Wrangler 3.80.0 — Cloudflare Workers dev, deploy, and D1 migration runner
- TypeScript 5.6 compiler (tsc) — typecheck via `pnpm typecheck` at root and per package

## Key Dependencies

**Runtime (`packages/api`):**
- `hono` 4.6.0 — only runtime dep
- Implicit (via Cloudflare bindings, not in `package.json`): D1Database, R2Bucket, Ai, VectorizeIndex, Fetcher (all from `@cloudflare/workers-types`)

**Runtime (`packages/dashboard`):**
- `astro` 4.16.0
- `react` 19.2.7, `react-dom` 19.2.7
- `@astrojs/react` 3.6.0
- `typescript` 5.6.0

**Dev / Build (api):**
- `@cloudflare/vitest-pool-workers` 0.7.0
- `@cloudflare/workers-types` 4.20241001.0
- `vitest` 3.0.0
- `wrangler` 3.80.0

**Dev / Build (dashboard):**
- `@astrojs/check` 0.9.9
- `@types/react` 19.2.16
- `typescript` 5.6.0

## Configuration

**TypeScript (`tsconfig.base.json` at root):**
- `target: "ES2022"`, `module: "ES2022"`, `moduleResolution: "bundler"`
- `strict: true`, `skipLibCheck: true`
- `noEmit: true` (wrangler/astro handle emit)
- `allowImportingTsExtensions: true`

**TypeScript (`packages/api/tsconfig.json`):**
- Extends base, `types: ["@cloudflare/workers-types"]`
- JSX configured: `jsx: "react-jsx"`, `jsxImportSource: "hono/jsx"`
- `rootDir: "src"`, `outDir: "dist"`

**TypeScript (`packages/dashboard/tsconfig.json`):**
- Extends base, `types: ["astro/client"]`
- JSX configured: `jsx: "react-jsx"`, `jsxImportSource: "react"`
- `outDir: "dist"`

**Wrangler (`packages/api/wrangler.toml`):**
- `name = "butchi-api"`, `main = "src/index.ts"`
- Bindings: D1 `DB` (`butchi-db`, id `e4143f19-...`), R2 `R2` (`butchi-rag`), AI Gateway `AI_GATEWAY` (`butchi-gateway`), Workers AI `ai`, Vectorize `VECTORIZE` (`butchi-rag-index`), Assets `ASSETS` (serves `../dashboard/dist`)
- `nodejs_compat` flag enabled
- `[vars]` ENVIRONMENT, OTP_EMAIL_FROM

**Astro (`packages/dashboard/astro.config.mjs`):**
- `output: "static"` (pure SSG, no SSR runtime)
- `integrations: [react()]` (no cloudflare adapter — assets are served by the Worker via the ASSETS binding)

**Vitest (`packages/api/vitest.config.ts`):**
- `globals: true`, `environment: "node"`, `include: ["src/services/__tests__/**/*.test.ts"]`

**Env vars (`.dev.vars.example`):**
- `JWT_SECRET`, `EMAILIT_API_KEY`, `OTP_EMAIL_FROM`, `ENVIRONMENT`

**Package Scripts (root `package.json`):**
- `dev` / `dev:api` / `dev:dashboard` — parallel/individual dev
- `build` — `pnpm --filter api build && pnpm --filter dashboard build` (api uses `wrangler deploy --dry-run`, dashboard uses `astro build`)
- `lint` — `pnpm -r lint` (currently a no-op echo per package)
- `typecheck` — `pnpm -r typecheck`

**Deploy (`deploy.sh` at repo root):**
- `pnpm install` → `wrangler d1 migrations apply butchi-db --remote` → `astro build` → `wrangler deploy` — single Worker serves both API and dashboard assets

## Platform Requirements

**Development:**
- Node.js >= 22 (root `engines` field)
- pnpm 9+ with workspace support
- Wrangler CLI (invoked via `pnpm --filter api exec wrangler ...`)
- macOS/Linux/WSL — `workerd` is listed under `allowBuilds` in `pnpm-workspace.yaml` (native binary)

**Production:**
- Cloudflare Workers (single Worker, runtime `workerd`)
- Cloudflare D1 (SQLite at edge)
- Cloudflare R2 (object storage)
- Cloudflare Vectorize (vector index)
- Cloudflare AI Gateway + Workers AI (inference + caching)
- Public URL: `https://butchi-api.ngoclamlai.workers.dev` (from `deploy.sh`)

---

*Stack analysis: 2026-06-04*
