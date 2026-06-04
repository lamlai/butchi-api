import type { Context, Next } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    apiKeyId: string;
    apiKeyName: string;
  }
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function generateApiKey(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const key = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `sk-${key}`;
}

function getKeyPrefix(key: string): string {
  return key.substring(0, 12); // "sk-" + 9 chars
}

export interface ApiKeyMiddlewareDeps {
  db: D1Database;
}

export function createApiKeyMiddleware(deps: ApiKeyMiddlewareDeps) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer sk-")) {
      return c.json({ error: "Unauthorized: invalid API key format" }, 401);
    }

    const apiKey = authHeader.slice(7);
    const keyHash = await hashKey(apiKey);

    const keyRecord = await deps.db
      .prepare(
        "SELECT id, name, revoked, user_id FROM api_keys WHERE key_hash = ?"
      )
      .bind(keyHash)
      .first<{ id: string; name: string; revoked: number; user_id: string }>();

    if (!keyRecord) {
      return c.json({ error: "Unauthorized: API key not found" }, 401);
    }

    if (keyRecord.revoked) {
      return c.json({ error: "Forbidden: API key has been revoked" }, 403);
    }

    // Update last_used_at
    await deps.db
      .prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), keyRecord.id)
      .run();

    c.set("userId", keyRecord.user_id);
    c.set("apiKeyId", keyRecord.id);
    c.set("apiKeyName", keyRecord.name);

    await next();
  };
}

export { generateApiKey, hashKey, getKeyPrefix };
