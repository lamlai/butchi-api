// Pricing in cents per 1M tokens
export const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4o": { inputPer1M: 250, outputPer1M: 1000 },
  "gpt-4o-mini": { inputPer1M: 15, outputPer1M: 60 },
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": { inputPer1M: 0, outputPer1M: 0 },
};

export function getModelPrice(model: string): { inputPer1M: number; outputPer1M: number } {
  return PRICING[model] ?? { inputPer1M: 15, outputPer1M: 60 };
}
