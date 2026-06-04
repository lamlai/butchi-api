import { Hono } from "hono";
import { createApiKeyMiddleware } from "../middleware/api-key-middleware";
import { createRateLimitMiddleware } from "../middleware/rate-limit-middleware";
import { createGatewayService, estimateMessagesTokens } from "../services/gateway-service";
import { createBillingService } from "../services/billing-service";
import { calculateCost } from "../services/token-counter-service";
import { createRAGService } from "../services/rag-service";
import { generateId } from "../lib/id-utils";
import type { OpenAIRequest } from "../types/openai-types";

type Bindings = {
  DB: D1Database;
  AI: Ai;
  R2: R2Bucket;
  VECTORIZE: VectorizeIndex;
  AI_GATEWAY: { gateway_id: string };
};

export function createOpenAIRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();

  // Apply API key + rate limit middleware
  router.use("*", (c, next) => {
    const mw = createApiKeyMiddleware({ db: c.env.DB });
    return mw(c, next);
  });
  router.use("*", (c, next) => {
    const mw = createRateLimitMiddleware();
    return mw(c, next);
  });

  // POST /v1/chat/completions
  router.post("/chat/completions", async (c) => {
    try {
      const body = await c.req.json<OpenAIRequest>();
      const stream = body.stream ?? false;
      const inputTokens = estimateMessagesTokens(body.messages);
      const billing = createBillingService();
      const userId = c.get("userId") as string;
      const apiKeyId = c.get("apiKeyId") as string;

      // Check sufficient balance
      const estimatedCost = billing.calculateCost(body.model, inputTokens, 0);
      if (estimatedCost > 0) {
        const hasBalance = await billing.checkSufficientBalance(c.env.DB, userId, estimatedCost);
        if (!hasBalance) {
          return c.json({ error: "Insufficient balance" }, 402);
        }
      }

      const ragService = createRAGService({
        ai: c.env.AI,
        r2: c.env.R2,
        vectorize: c.env.VECTORIZE,
      });

      // Enrich messages with RAG context
      const ragConfig = ragService.parseConfig(c.req.raw.headers);
      const { messages: enrichedMessages } = await ragService.enrichMessages(
        body.messages,
        ragConfig
      );

      const enrichedBody = { ...body, messages: enrichedMessages };
      const gateway = createGatewayService({
        gatewayId: c.env.AI_GATEWAY.gateway_id,
      });

      if (stream) {
        const upstream = await gateway.forwardStreamRequest(enrichedBody);

        // Log streaming usage with estimated output tokens
        c.executionCtx.waitUntil(
          (async () => {
            const cost = billing.calculateCost(body.model, inputTokens, Math.ceil(inputTokens * 0.5));
            await c.env.DB
              .prepare(
                "INSERT INTO usage_logs (id, user_id, api_key_id, model, input_tokens, output_tokens, cost_cents) VALUES (?, ?, ?, ?, ?, ?, ?)"
              )
              .bind(generateId(), userId, apiKeyId, body.model, inputTokens, Math.ceil(inputTokens * 0.5), cost)
              .run()
              .catch((err) => console.error("Failed to log streaming usage:", err));
            await billing.deductBalance(c.env.DB, userId, cost).catch(() => {});
          })()
        );

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      const result = await gateway.forwardRequest(enrichedBody);
      const outputTokens = result.outputTokens;
      const cost = calculateCost(body.model, inputTokens, outputTokens);

      // Log usage and deduct balance
      await c.env.DB
        .prepare(
          "INSERT INTO usage_logs (id, user_id, api_key_id, model, input_tokens, output_tokens, cost_cents) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(generateId(), userId, apiKeyId, body.model, inputTokens, outputTokens, cost)
        .run();

      if (cost > 0) {
        await billing.deductBalance(c.env.DB, userId, cost);
      }

      return c.json(result.response);
    } catch (err) {
      console.error("OpenAI route error:", err);
      return c.json(
        { error: err instanceof Error ? err.message : "Internal server error" },
        500
      );
    }
  });

  return router;
}
