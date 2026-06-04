# Testing Patterns

**Analysis Date:** 2026-06-04

## Test Framework

**Runner:**
- Vitest 3.0 (`vitest: ^3.0.0` in `packages/api/package.json`)
- Worker pool: `@cloudflare/vitest-pool-workers` 0.7 — runs tests in a real Cloudflare Workers runtime with bindings (D1, R2, Vectorize, AI) available
- Config: `packages/api/vitest.config.ts` — defines `globals: true` (no need to import `describe`/`it`/`expect` from vitest) and `environment: "node"` (though the pool override makes it workers)

**Assertion Library:**
- Vitest's built-in `expect` (no chai/jest-cucumber)

**Imports (per observed files):**
- `import { describe, it, expect, vi, beforeEach } from "vitest";` — explicit imports even though `globals: true` is set
- This is consistent across all 4 existing test files

**Run Commands:**
```bash
# In packages/api
pnpm test              # vitest run (single run)
pnpm test:watch        # vitest (watch mode)

# From monorepo root
pnpm --filter api test
```

## Test File Organization

**Location:**
- Co-located in `packages/api/src/services/__tests__/` (e.g., `packages/api/src/services/__tests__/billing-service.test.ts`)
- Configured via `include: ["src/services/__tests__/**/*.test.ts"]` in `vitest.config.ts:7`
- Only services are tested — routes, middleware, and types have no test coverage

**Naming:**
- `<service-name>.test.ts` mirrors the service file (e.g., `billing-service.test.ts` tests `billing-service.ts`)
- Test describe block name: the service class in PascalCase (e.g., `describe("Billing Service", ...)`)

**Current Coverage (4 test files):**
- `billing-service.test.ts` — 60 lines, 5 tests
- `jwt-service.test.ts` — 57 lines, 5 tests
- `otp-service.test.ts` — 102 lines, 4 tests (the most thorough; uses an in-memory mock DB)
- `token-counter-service.test.ts` — 69 lines, 7 tests

## Test Structure

**Suite Organization:**
```ts
import { describe, it, expect, vi } from "vitest";
import { createBillingService } from "../billing-service";

describe("Billing Service", () => {
  const billing = createBillingService();   // shared instance for suite

  describe("calculateCost", () => {           // nested describe per method
    it("calculates cost in cents", () => {
      const cost = billing.calculateCost("gpt-4o", 1000, 500);
      expect(Number.isInteger(cost)).toBe(true);
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });
  // ...
});
```

**Patterns observed:**

1. **Shared instance at top of `describe` block** — `const billing = createBillingService();` declared once per suite, reused across `it` blocks (e.g., `packages/api/src/services/__tests__/billing-service.test.ts:5`)

2. **Nested `describe` per public method** — groups `it` cases by method, e.g., `describe("checkSufficientBalance", ...)`, `describe("calculateCost", ...)` (`billing-service.test.ts:7, 15`)

3. **Helper factory functions at the top of the file** — e.g., `function createMockDb()` in `otp-service.test.ts:4-67` that returns a typed mock D1

4. **`beforeEach` to reset shared mutable state** — used in `otp-service.test.ts:72-74`:
   ```ts
   beforeEach(() => {
     mockDb = createMockDb();
   });
   ```

5. **No explicit teardown** — no `afterEach`/`afterAll` calls; tests rely on `beforeEach` reset

6. **Magic-string SQL inspection** — the mock DB in `otp-service.test.ts` uses `_sql.startsWith("INSERT")`, `_sql.includes("COUNT")`, `_sql.includes("SELECT *")`, `_sql.includes("UPDATE")` to dispatch behavior. Brittle but consistent.

## Mocking

**Framework:** Vitest's built-in `vi` (`vi.fn`, `vi.spyOn`)

**Patterns observed:**

1. **Inline `vi.fn()` chains for D1 mock** (simple case — `billing-service.test.ts:17-24`):
   ```ts
   const mockDb = {
     prepare: vi.fn(() => ({
       bind: vi.fn(() => ({
         first: vi.fn(async () => ({ balance_cents: 100 })),
         run: vi.fn(),
       })),
     })),
   } as unknown as D1Database;
   ```

2. **Stateful in-memory mock with SQL dispatch** (full case — `otp-service.test.ts:4-67`):
   ```ts
   function createMockDb() {
     const otpCodes: Array<{...}> = [];
     return {
       prepare: vi.fn((_sql: string) => ({
         bind: (...args: unknown[]) => {
           const boundArgs = args;
           return {
             run: vi.fn(async () => {
               if (_sql.startsWith("INSERT")) {
                 // mutate otpCodes array
               }
               return { meta: { changes: 1 } };
             }),
             first: vi.fn(async <T>(): Promise<T | null> => {
               if (_sql.includes("COUNT")) { ... }
               if (_sql.includes("SELECT *")) { ... }
             }),
           };
         },
       })),
     } as unknown as D1Database;
   }
   ```

3. **Type casting pattern** — `as unknown as D1Database` is the standard escape hatch for assigning a partial mock to the `D1Database` global type. Used in all tests that mock the DB.

4. **What is mocked:**
   - D1 database (`D1Database`) — heavily used, always mocked
   - Time (implicitly — not mocked, but JWT expiry test handles the 1-hour default by signing a fresh token)
   - `crypto.subtle` / `crypto.randomUUID` — **NOT mocked**; real crypto used in JWT and OTP tests

5. **What is NOT mocked:**
   - `crypto` global — JWT test relies on real `crypto.subtle.sign` / `HMAC` operations
   - `Date.now()` — JWT expiry test acknowledges limitation in a comment (test on line 21-35 only verifies freshly-issued tokens, not actually expired ones)
   - Email, R2, Vectorize, AI Gateway — not exercised by any test (services that use them have no tests)

## Fixtures and Factories

**Test Data:**
- Inline literals, no factory functions for test data objects
- Example (`token-counter-service.test.ts:40-42`):
  ```ts
  const messages: OpenAIMessage[] = [{ role: "user", content: "Hello" }];
  ```
- Magic string inputs in test names (e.g., `"user-1"`, `"test@test.com"`)

**Constants:**
- Module-level constants at the top of the test file (e.g., `const TEST_SECRET = "test-secret-key";` in `jwt-service.test.ts:4`)

**Location:**
- Fixtures are inline in the test file; no `__fixtures__/` directory or `fixtures.ts` helper
- No separate factory module

## Coverage

**Requirements:** None enforced. No `--coverage` flag, no `coverageThreshold` in vitest config.

**View Coverage:**
```bash
# Add to packages/api/vitest.config.ts if needed:
# test: { coverage: { provider: "v8", reporter: ["text", "html"] } }
# Then: pnpm test --coverage
```

**Current observed coverage (by file):**
- `billing-service.ts` — 3 of 5 methods covered (`calculateCost`, `checkSufficientBalance`, `getBalance`); `deductBalance` and `addCredit` uncovered
- `jwt-service.ts` — `sign` and `verify` covered (5 cases)
- `otp-service.ts` — `generateOtp`, `validateOtp` covered; `markUsed`, `getRecentCount`, `incrementAttempts` reached indirectly via the SQL-dispatch mock
- `token-counter-service.ts` — `calculateCost` and `estimateMessagesTokens` covered
- No coverage of: routes, middleware, email-service, gateway-service, indexer-service, rag-service, vectorize-service, sepay-service, proof-upload-service, r2-storage-service, context-builder-service, embedding-service, usage-service

## Test Types

**Unit Tests:**
- Scope: individual service factory functions
- Approach: in-process execution with mocked D1; no network, no real Workers bindings exercised
- All 4 existing tests are unit-level

**Integration Tests:**
- None present
- `@cloudflare/vitest-pool-workers` is installed and would allow tests to run against real D1/R2/Vectorize bindings via `SELF.fetch()` or `env.DB.prepare(...)`, but no such tests exist

**E2E Tests:**
- Not used. No Playwright, no `vitest-browser`, no end-to-end framework.

## Common Patterns

**Async Testing:**
```ts
it("returns true when balance is sufficient", async () => {
  // ...
  const result = await billing.checkSufficientBalance(mockDb, "user-1", 50);
  expect(result).toBe(true);
});
```
- All async cases use `async () =>` on the `it` callback; `await` directly inside
- No `done` callbacks, no `resolves`/`rejects` matchers — direct `await` + `expect` is the norm

**Error Testing:**
- Not exercised in any current test (no `expect(() => fn()).toThrow(...)` pattern)
- Indirectly tested: `jwt-service.test.ts:43` checks `await jwt.verify(tamperedToken)` returns `null`
- The `if (err instanceof Error && err.message === "RATE_LIMIT_EXCEEDED")` branch in `auth-routes.ts:35` is **not** unit-tested

**Numeric Boundary Testing:**
- Token counter tests use boundary values and check both exact (`expect(cost).toBe(1)`) and relational (`expect(cost).toBeGreaterThanOrEqual(0)`) assertions
- `expect(Number.isInteger(cost)).toBe(true)` is used to assert the return is an integer (since exact cents depend on pricing config)

**Existence/Shape Testing:**
- `expect(payload).not.toBeNull();` then `expect(payload!.sub).toBe("user-1");` (jwt-service.test.ts:16-18) — uses non-null assertion `!` after the null check

## Where to Add New Tests

**New Service Test:**
- Create `packages/api/src/services/__tests__/<name>-service.test.ts`
- Follow the existing structure: `describe("<Name> Service", ...)` with a shared instance, nested `describe` per public method
- Use `vi.fn()` chain for simple D1 mocks; build a stateful `createMockDb()` factory if behavior depends on prior writes

**New Test Patterns to Consider (Not Currently Used):**
- **Error path tests** — `expect(() => fn()).rejects.toThrow("CODE")` for service-level throws (e.g., `OtpService.generateOtp` rate-limit, `BillingService.deductBalance` insufficient)
- **Route handler tests** — use `Hono` `app.request("/path", { method, body, headers })` against a constructed app instance
- **Snapshot tests** — none used; would fit response shape assertions for stable endpoints
- **Property-based tests** — none used; `fast-check` not installed

**Test Frameworks NOT Installed:**
- No `@vitest/coverage-v8` — coverage not collected
- No `@testing-library/react` — no React component tests (dashboard has no tests at all)
- No `playwright` / `chromium` — no E2E
- No `nock` / `msw` — no HTTP mocking for outbound calls (gateway, emailit)

**Dashboard Testing:**
- `packages/dashboard` has no test framework installed, no test scripts, no test files
- To add tests: install `vitest` + `@testing-library/react` + `jsdom`, add a `vitest.config.ts`, and add a `test` script to `packages/dashboard/package.json`
- The Astro-recommended test stack (`@playwright/test` for E2E, `vitest` for unit) is not set up
