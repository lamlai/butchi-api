import type { Context, Next } from "hono";
import { createJwtService } from "../services/jwt-service";

export interface AuthUser {
  userId: string;
  email: string;
}

// Extend Hono context variables
declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

interface HasJwtSecret {
  JWT_SECRET: string;
}

export function createAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized: missing token" }, 401);
    }

    const token = authHeader.slice(7);
    const jwtSecret = (c.env as HasJwtSecret).JWT_SECRET;
    const jwt = createJwtService(jwtSecret);
    const payload = await jwt.verify(token);

    if (!payload) {
      return c.json({ error: "Unauthorized: invalid or expired token" }, 401);
    }

    c.set("user", { userId: payload.sub, email: payload.email });
    await next();
  };
}
