import type { Context, Next } from "hono";
import { createJwtService } from "../services/jwt-service";

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

// Extend Hono context variables
declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

interface HasJwtSecret {
  JWT_SECRET: string;
  DB: D1Database;
}

export function createAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized: missing token" }, 401);
    }

    const token = authHeader.slice(7);
    const env = c.env as HasJwtSecret;
    const jwt = createJwtService(env.JWT_SECRET);
    const payload = await jwt.verify(token);

    if (!payload) {
      return c.json({ error: "Unauthorized: invalid or expired token" }, 401);
    }

    const userRow = await env.DB
      .prepare("SELECT status FROM users WHERE id = ?")
      .bind(payload.sub)
      .first<{ status: string | null }>();

    if (userRow && userRow.status && userRow.status !== "active") {
      return c.json({ error: "Account deactivated" }, 403);
    }

    c.set("user", { userId: payload.sub, email: payload.email, role: payload.role || "user" });
    await next();
  };
}
