import type { Context, Next } from "hono";

/**
 * Admin authorization middleware.
 * Requires `createAuthMiddleware` to run first in the chain.
 * Checks that the authenticated user has role == "admin".
 */
export function createAdminMiddleware() {
  return async (c: Context, next: Next) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized: not authenticated" }, 401);
    }

    if (user.role !== "admin") {
      return c.json({ error: "Forbidden: admin access required" }, 403);
    }

    await next();
  };
}
