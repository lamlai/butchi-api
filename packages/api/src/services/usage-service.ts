import { generateId } from "../lib/id-utils";

export interface UsageService {
  logUsage(
    db: D1Database,
    params: {
      userId: string;
      apiKeyId: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      costCents: number;
    }
  ): Promise<void>;
  getUsageStats(db: D1Database, userId: string): Promise<{
    totalTokens: number;
    totalCost: number;
    currentPeriod: string;
  }>;
  getUsageHistory(
    db: D1Database,
    userId: string,
    page: number,
    limit: number
  ): Promise<{ items: unknown[]; total: number }>;
  getDailyUsage(
    db: D1Database,
    userId: string,
    days: number
  ): Promise<{ date: string; tokens: number; cost: number }[]>;
}

export function createUsageService(): UsageService {
  const logUsage = async (
    db: D1Database,
    params: {
      userId: string;
      apiKeyId: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      costCents: number;
    }
  ): Promise<void> => {
    await db
      .prepare(
        "INSERT INTO usage_logs (id, user_id, api_key_id, model, input_tokens, output_tokens, cost_cents) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        generateId(),
        params.userId,
        params.apiKeyId,
        params.model,
        params.inputTokens,
        params.outputTokens,
        params.costCents
      )
      .run();
  };

  const getUsageStats = async (
    db: D1Database,
    userId: string
  ): Promise<{
    totalTokens: number;
    totalCost: number;
    currentPeriod: string;
  }> => {
    // Current month stats
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const result = await db
      .prepare(
        "SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens, COALESCE(SUM(cost_cents), 0) as total_cost FROM usage_logs WHERE user_id = ? AND created_at >= ?"
      )
      .bind(userId, monthStart.toISOString())
      .first<{ total_tokens: number; total_cost: number }>();

    return {
      totalTokens: result?.total_tokens ?? 0,
      totalCost: result?.total_cost ?? 0,
      currentPeriod: monthStart.toISOString().slice(0, 7),
    };
  };

  const getUsageHistory = async (
    db: D1Database,
    userId: string,
    page: number,
    limit: number
  ): Promise<{ items: unknown[]; total: number }> => {
    const offset = (page - 1) * limit;

    const items = await db
      .prepare(
        "SELECT model, input_tokens, output_tokens, cost_cents, created_at FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      )
      .bind(userId, limit, offset)
      .all();

    const countResult = await db
      .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE user_id = ?")
      .bind(userId)
      .first<{ count: number }>();

    return {
      items: items.results ?? [],
      total: countResult?.count ?? 0,
    };
  };

  const getDailyUsage = async (
    db: D1Database,
    userId: string,
    days: number
  ): Promise<{ date: string; tokens: number; cost: number }[]> => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const results = await db
      .prepare(
        "SELECT DATE(created_at) as date, SUM(input_tokens + output_tokens) as tokens, SUM(cost_cents) as cost FROM usage_logs WHERE user_id = ? AND created_at >= ? GROUP BY DATE(created_at) ORDER BY date ASC"
      )
      .bind(userId, cutoff.toISOString())
      .all<{ date: string; tokens: number; cost: number }>();

    return results.results ?? [];
  };

  return {
    logUsage,
    getUsageStats,
    getUsageHistory,
    getDailyUsage,
  };
}
