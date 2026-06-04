import { getModelPrice } from "../config/pricing-config";
import { generateId } from "../lib/id-utils";

// Exchange rate: 1 USD ≈ 25,500 VND
const VND_TO_USD_CENTS = 100 / 25_500;

export function vndToUsdCents(vnd: number): number {
  return Math.floor(vnd * VND_TO_USD_CENTS);
}

export interface BillingService {
  calculateCost(model: string, inputTokens: number, outputTokens: number): number;
  getBalance(db: D1Database, userId: string): Promise<number>;
  deductBalance(db: D1Database, userId: string, amountCents: number): Promise<void>;
  addCredit(
    db: D1Database,
    userId: string,
    amountCents: number,
    transactionId: string
  ): Promise<void>;
  checkSufficientBalance(
    db: D1Database,
    userId: string,
    estimatedCostCents: number
  ): Promise<boolean>;
}

export function createBillingService(): BillingService {
  const calculateCost = (
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number => {
    const pricing = getModelPrice(model);
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
    return Math.ceil(inputCost + outputCost);
  };

  const getBalance = async (
    db: D1Database,
    userId: string
  ): Promise<number> => {
    const result = await db
      .prepare("SELECT balance_cents FROM users WHERE id = ?")
      .bind(userId)
      .first<{ balance_cents: number }>();
    return result?.balance_cents ?? 0;
  };

  const deductBalance = async (
    db: D1Database,
    userId: string,
    amountCents: number
  ): Promise<void> => {
    const result = await db
      .prepare("UPDATE users SET balance_cents = balance_cents - ? WHERE id = ? AND balance_cents >= ?")
      .bind(amountCents, userId, amountCents)
      .run();
    if (result.meta.changes === 0) {
      throw new Error("Insufficient balance");
    }
  };

  const addCredit = async (
    db: D1Database,
    userId: string,
    amountCents: number,
    _transactionId: string
  ): Promise<void> => {
    await db
      .prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?")
      .bind(amountCents, userId)
      .run();
  };

  const checkSufficientBalance = async (
    db: D1Database,
    userId: string,
    estimatedCostCents: number
  ): Promise<boolean> => {
    const balance = await getBalance(db, userId);
    return balance >= estimatedCostCents;
  };

  return {
    calculateCost,
    getBalance,
    deductBalance,
    addCredit,
    checkSufficientBalance,
  };
}
