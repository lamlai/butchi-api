import { Hono } from "hono";
import { createAuthMiddleware } from "../middleware/auth-middleware";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export function createProfileRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();

  const auth = createAuthMiddleware();

  // GET /api/profile
  router.get("/", auth, async (c) => {
    const user = c.get("user");

    const profile = await c.env.DB
      .prepare("SELECT id, email, name FROM users WHERE id = ?")
      .bind(user.userId)
      .first<{ id: string; email: string; name: string | null }>();

    if (!profile) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(profile);
  });

  // PUT /api/profile
  router.put("/", auth, async (c) => {
    const user = c.get("user");
    const { name } = await c.req.json<{ name: string }>();

    await c.env.DB
      .prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?")
      .bind(name, new Date().toISOString(), user.userId)
      .run();

    return c.json({ message: "Profile updated" });
  });

  return router;
}
