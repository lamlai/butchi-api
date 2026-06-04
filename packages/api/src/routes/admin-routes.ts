import { Hono } from "hono";
import { createAuthMiddleware } from "../middleware/auth-middleware";
import { createAdminMiddleware } from "../middleware/admin-middleware";
import { createIndexerService } from "../services/indexer-service";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  AI: Ai;
  R2: R2Bucket;
  VECTORIZE: VectorizeIndex;
};

export function createAdminRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();
  const auth = createAuthMiddleware();
  const admin = createAdminMiddleware();

  // POST /api/admin/reindex — trigger RAG index rebuild
  router.post("/reindex", auth, admin, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
      const prefix = typeof body === "object" && body !== null ? (body as Record<string, unknown>).prefix as string | undefined : undefined;

      const indexer = createIndexerService({
        ai: c.env.AI,
        r2: c.env.R2,
        vectorize: c.env.VECTORIZE,
      });

      // Fire and forget — indexing can take a while
      c.executionCtx.waitUntil(indexer.runIndex(prefix));

      return c.json({ message: "Indexing started", prefix: prefix ?? "all" }, 202);
    } catch (err) {
      console.error("Reindex error:", err);
      return c.json({ error: "Failed to start indexing" }, 500);
    }
  });

  return router;
}
