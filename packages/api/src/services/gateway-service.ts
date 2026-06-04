import type { OpenAIMessage, OpenAIRequest, OpenAIResponse } from "../types/openai-types";

export interface GatewayConfig {
  gatewayId: string;
}

export interface GatewayResult {
  response: OpenAIResponse;
  inputTokens: number;
  outputTokens: number;
}

// Simple token estimation (~4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: OpenAIMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

export function createGatewayService(config: GatewayConfig) {
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${config.gatewayId}/openai/chat/completions`;

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

  const forwardRequest = async (
    body: OpenAIRequest,
    apiKey?: string
  ): Promise<GatewayResult> => {
    const inputTokens = estimateMessagesTokens(body.messages);

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gateway error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const outputTokens =
      data.usage?.completion_tokens ??
      estimateTokens(data.choices?.[0]?.message?.content ?? "");

    return {
      response: data,
      inputTokens,
      outputTokens,
    };
  };

  const forwardStreamRequest = async (
    body: OpenAIRequest,
    apiKey?: string
  ): Promise<Response> => {
    // Stream through AI Gateway
    const upstream = await fetch(gatewayUrl, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      throw new Error(`Gateway stream error ${upstream.status}: ${errorText}`);
    }

    return upstream;
  };

  return {
    forwardRequest,
    forwardStreamRequest,
    estimateTokens,
    estimateMessagesTokens,
  };
}

