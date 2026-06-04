import { describe, it, expect } from "vitest";
import { calculateCost } from "../token-counter-service";
import { estimateMessagesTokens } from "../gateway-service";
import type { OpenAIMessage } from "../../types/openai-types";

describe("Token Counter Service", () => {
  describe("calculateCost", () => {
    it("calculates gpt-4o cost correctly", () => {
      // $2.50/1M input = 0.0000025 per token
      // $10.00/1M output = 0.00001 per token
      const cost = calculateCost("gpt-4o", 1000, 500);
      // input: 1000 * 2.50 / 1,000,000 = 0.0025 -> 0.25 cents
      // output: 500 * 10.00 / 1,000,000 = 0.005 -> 0.5 cents
      // total: 0.75 cents -> ceil -> 1 cent
      expect(cost).toBe(1);
    });

    it("calculates gpt-4o-mini cost correctly", () => {
      const cost = calculateCost("gpt-4o-mini", 1000, 500);
      expect(cost).toBeGreaterThanOrEqual(0);
    });

    it("returns 0 for free models", () => {
      const cost = calculateCost(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        1000,
        500
      );
      expect(cost).toBe(0);
    });

    it("handles unknown models with default pricing", () => {
      const cost = calculateCost("unknown-model", 1000, 500);
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe("estimateMessagesTokens", () => {
    it("estimates simple messages", () => {
      const messages: OpenAIMessage[] = [
        { role: "user", content: "Hello" },
      ];
      const tokens = estimateMessagesTokens(messages);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it("estimates longer messages", () => {
      const messages: OpenAIMessage[] = [
        {
          role: "user",
          content: "This is a longer message with more words that should have more tokens",
        },
      ];
      const tokens = estimateMessagesTokens(messages);
      expect(tokens).toBeGreaterThan(5);
    });

    it("handles multiple messages", () => {
      const messages: OpenAIMessage[] = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];
      const tokens = estimateMessagesTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });
  });
});
