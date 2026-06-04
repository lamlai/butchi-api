import { Hono } from "hono";
import { createAuthMiddleware } from "../middleware/auth-middleware";
import { createAdminMiddleware } from "../middleware/admin-middleware";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export function createAdminUserRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();
  const auth = createAuthMiddleware();
  const admin = createAdminMiddleware();

  // GET /api/admin/users — list all users
  router.get("/", auth, admin, async (c) => {
    const result = await c.env.DB
      .prepare(
        "SELECT id, email, name, role, status, balance_cents, created_at FROM users ORDER BY created_at DESC"
      )
      .all();
    return c.json(result.results ?? []);
  });

  // PATCH /api/admin/users/:id/status — change user status
  router.patch("/:id/status", auth, admin, async (c) => {
    const userId = c.req.param("id");
    const { status } = await c.req.json<{ status: string }>();

    const allowed = ["active", "inactive", "banned"];
    if (!allowed.includes(status)) {
      return c.json({ error: `Invalid status. Allowed: ${allowed.join(", ")}` }, 400);
    }

    const result = await c.env.DB
      .prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?")
      .bind(status, new Date().toISOString(), userId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ message: "Status updated", userId, status });
  });

  return router;
}
