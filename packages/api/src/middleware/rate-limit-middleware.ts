import type { Context, Next } from "hono";

interface RateLimitConfig {
  requestsPerMinute: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 60,
};

// In-memory sliding window counter (adequate for single-worker, resets on redeploy)
const counters = new Map<string, { count: number; resetAt: number }>();

export function createRateLimitMiddleware(config: RateLimitConfig = DEFAULT_CONFIG) {
  return async (c: Context, next: Next) => {
    const apiKeyId = c.get("apiKeyId") as string | undefined;
    const key = apiKeyId ?? "global";

    const now = Date.now();
    const entry = counters.get(key);

    if (!entry || now > entry.resetAt) {
      counters.set(key, { count: 1, resetAt: now + 60_000 });
      await next();
      return;
    }

    if (entry.count >= config.requestsPerMinute) {
      return c.json(
        {
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
        429
      );
    }

    entry.count++;
    await next();
  };
}
