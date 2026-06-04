import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { createApiKeyMiddleware } from "../middleware/api-key-middleware";
import { createRateLimitMiddleware } from "../middleware/rate-limit-middleware";
import { createBillingService } from "../services/billing-service";
import { createGatewayService } from "../services/gateway-service";
import { createRAGService } from "../services/rag-service";
import { generateId } from "../lib/id-utils";
import { calculateCost } from "../services/token-counter-service";
import type { AnthropicRequest, AnthropicResponse } from "../types/anthropic-types";
import type { OpenAIMessage } from "../types/openai-types";

type Bindings = {
  DB: D1Database;
  AI_GATEWAY: { gateway_id: string };
  AI: Ai;
  R2: R2Bucket;
  VECTORIZE: VectorizeIndex;
};

// Estimate tokens for Anthropic messages
function estimateText(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateMessages(messages: AnthropicRequest["messages"]): number {
  return messages.reduce((sum, m) => {
    if (typeof m.content === "string") return sum + estimateText(m.content);
    return sum + m.content.reduce((s, c) => s + estimateText(c.text), 0);
  }, 0);
}

export function createAnthropicRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();

  router.use("*", (c, next) => {
    const mw = createApiKeyMiddleware({ db: c.env.DB });
    return mw(c, next);
  });
  router.use("*", (c, next) => {
    const mw = createRateLimitMiddleware();
    return mw(c, next);
  });

  // POST /v1/messages
  router.post("/messages", async (c) => {
    try {
      const body = await c.req.json<AnthropicRequest>();
      const inputTokens = estimateMessages(body.messages);
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

      // RAG enrichment (same as OpenAI route)
      const ragService = createRAGService({
        ai: c.env.AI,
        r2: c.env.R2,
        vectorize: c.env.VECTORIZE,
      });
      const ragConfig = ragService.parseConfig(c.req.raw.headers);

      // Transform to OpenAI format for AI Gateway + RAG
      let openAIMessages: OpenAIMessage[] = body.messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" as const : "user" as const,
        content: typeof m.content === "string" ? m.content : m.content.map((c) => c.text).join("\n"),
      }));

      if (body.system) {
        openAIMessages.unshift({ role: "system", content: body.system });
      }

      // Apply RAG enrichment to OpenAI-format messages
      const enriched = await ragService.enrichMessages(openAIMessages, ragConfig);
      openAIMessages = enriched.messages;

      const gateway = createGatewayService({
        gatewayId: c.env.AI_GATEWAY.gateway_id,
      });

      if (body.stream) {
        const upstream = await gateway.forwardStreamRequest({
          model: body.model,
          messages: openAIMessages,
          max_tokens: body.max_tokens,
          temperature: body.temperature,
          stream: true,
        });

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

      const result = await gateway.forwardRequest({
        model: body.model,
        messages: openAIMessages,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
        stream: false,
      });

      const outputTokens = result.outputTokens;
      const cost = calculateCost(body.model, inputTokens, outputTokens);

      const content = result.response.choices?.[0]?.message?.content ?? "";

      const anthropicResponse: AnthropicResponse = {
        id: `msg_${generateId()}`,
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: content }],
        model: body.model,
        stop_reason: "end_turn",
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      };

      // Log usage
      await c.env.DB
        .prepare(
          "INSERT INTO usage_logs (id, user_id, api_key_id, model, input_tokens, output_tokens, cost_cents) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(generateId(), userId, apiKeyId, body.model, inputTokens, outputTokens, cost)
        .run();

      if (cost > 0) {
        await billing.deductBalance(c.env.DB, userId, cost);
      }

      return c.json(anthropicResponse);
    } catch (err) {
      console.error("Anthropic route error:", err);
      return c.json(
        { error: err instanceof Error ? err.message : "Internal server error" },
        500
      );
    }
  });

  return router;
}
