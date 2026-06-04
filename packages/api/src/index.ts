import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createAuthRoutes } from "./routes/auth-routes";
import { createOpenAIRoutes } from "./routes/openai-routes";
import { createAnthropicRoutes } from "./routes/anthropic-routes";
import { createAdminRoutes } from "./routes/admin-routes";
import { createProfileRoutes } from "./routes/profile-routes";
import { createApiKeyRoutes } from "./routes/api-key-routes";
import { createUsageRoutes } from "./routes/usage-routes";
import { createBillingRoutes } from "./routes/billing-routes";
import { createWebhookRoutes } from "./routes/webhook-routes";

type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  AI_GATEWAY: { gateway_id: string };
  VECTORIZE: VectorizeIndex;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  OTP_EMAIL_FROM: string;
  SEPAY_BANK_CODE?: string;
  SEPAY_ACCOUNT_NUMBER?: string;
  SEPAY_ACCOUNT_NAME?: string;
  SEPAY_WEBHOOK_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({
  origin: ["http://localhost:4321", "https://butchi-dashboard.pages.dev"],
  credentials: true,
}));
app.use("*", logger());

app.get("/health", (c) => {
  return c.json({ status: "ok", environment: c.env.ENVIRONMENT });
});

app.get("/", (c) => {
  return c.json({ name: "Butchi API", version: "0.1.0" });
});

// Auth routes
app.route("/api/auth", createAuthRoutes());

// API Gateway routes (OpenAI-compatible)
app.route("/v1", createOpenAIRoutes());

// API Gateway routes (Anthropic-compatible)
app.route("/v1", createAnthropicRoutes());

// Admin routes
app.route("/api/admin", createAdminRoutes());

// Dashboard API routes
app.route("/api/profile", createProfileRoutes());
app.route("/api/keys", createApiKeyRoutes());
app.route("/api/usage", createUsageRoutes());
app.route("/api/billing", createBillingRoutes());
app.route("/api/webhooks", createWebhookRoutes());

export default app;
