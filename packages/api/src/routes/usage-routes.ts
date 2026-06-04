import { Hono } from "hono";
import { createAuthMiddleware } from "../middleware/auth-middleware";
import { createUsageService } from "../services/usage-service";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export function createUsageRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();
  const auth = createAuthMiddleware();
  const usageService = createUsageService();

  // GET /api/usage — usage stats (current period)
  router.get("/", auth, async (c) => {
    const user = c.get("user");
    const stats = await usageService.getUsageStats(c.env.DB, user.userId);
    return c.json(stats);
  });

  // GET /api/usage/history — paginated usage log
  router.get("/history", auth, async (c) => {
    const user = c.get("user");
    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 20;

    const history = await usageService.getUsageHistory(
      c.env.DB,
      user.userId,
      page,
      limit
    );
    return c.json(history);
  });

  // GET /api/usage/daily — daily aggregation for chart
  router.get("/daily", auth, async (c) => {
    const user = c.get("user");
    const days = Number(c.req.query("days")) || 30;

    const daily = await usageService.getDailyUsage(
      c.env.DB,
      user.userId,
      days
    );
    return c.json(daily);
  });

  return router;
}
