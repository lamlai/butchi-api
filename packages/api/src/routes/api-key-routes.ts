import { Hono } from "hono";
import { createAuthMiddleware } from "../middleware/auth-middleware";
import { generateApiKey, hashKey, getKeyPrefix } from "../middleware/api-key-middleware";
import { generateId } from "../lib/id-utils";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export function createApiKeyRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();

  const auth = createAuthMiddleware();

  // GET /api/keys — list user's API keys
  router.get("/", auth, async (c) => {
    const user = c.get("user");

    const keys = await c.env.DB
      .prepare(
        "SELECT id, key_prefix as prefix, name, last_used_at, created_at FROM api_keys WHERE user_id = ? AND revoked = 0 ORDER BY created_at DESC"
      )
      .bind(user.userId)
      .all<{ id: string; prefix: string; name: string; last_used_at: string | null; created_at: string }>();

    return c.json(keys.results ?? []);
  });

  // POST /api/keys — create new API key
  router.post("/", auth, async (c) => {
    const user = c.get("user");
    const { name } = await c.req.json<{ name: string }>();

    if (!name || typeof name !== "string") {
      return c.json({ error: "Name is required" }, 400);
    }

    const rawKey = await generateApiKey();
    const keyHash = await hashKey(rawKey);
    const prefix = getKeyPrefix(rawKey);
    const id = generateId();

    await c.env.DB
      .prepare(
        "INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(id, user.userId, keyHash, prefix, name)
      .run();

    return c.json({ id, key: rawKey, name }, 201);
  });

  // DELETE /api/keys/:id — revoke API key
  router.delete("/:id", auth, async (c) => {
    const user = c.get("user");
    const keyId = c.req.param("id");

    const result = await c.env.DB
      .prepare("UPDATE api_keys SET revoked = 1 WHERE id = ? AND user_id = ?")
      .bind(keyId, user.userId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: "Key not found" }, 404);
    }

    return c.json({ message: "Key revoked" });
  });

  return router;
}
