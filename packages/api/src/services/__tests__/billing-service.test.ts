import { describe, it, expect, vi } from "vitest";
import { createBillingService } from "../billing-service";

describe("Billing Service", () => {
  const billing = createBillingService();

  describe("calculateCost", () => {
    it("calculates cost in cents", () => {
      const cost = billing.calculateCost("gpt-4o", 1000, 500);
      expect(Number.isInteger(cost)).toBe(true);
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe("checkSufficientBalance", () => {
    it("returns true when balance is sufficient", async () => {
      const mockDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({ balance_cents: 100 })),
            run: vi.fn(),
          })),
        })),
      } as unknown as D1Database;

      const result = await billing.checkSufficientBalance(mockDb, "user-1", 50);
      expect(result).toBe(true);
    });

    it("returns false when balance is insufficient", async () => {
      const mockDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({ balance_cents: 10 })),
            run: vi.fn(),
          })),
        })),
      } as unknown as D1Database;

      const result = await billing.checkSufficientBalance(mockDb, "user-1", 50);
      expect(result).toBe(false);
    });
  });

  describe("getBalance", () => {
    it("returns 0 for new users", async () => {
      const mockDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => null),
            run: vi.fn(),
          })),
        })),
      } as unknown as D1Database;

      const balance = await billing.getBalance(mockDb, "new-user");
      expect(balance).toBe(0);
    });
  });
});
