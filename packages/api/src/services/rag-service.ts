import { createEmbeddingService, EMBEDDING_DIMENSIONS } from "./embedding-service";
import { createR2StorageService } from "./r2-storage-service";
import { createVectorizeService } from "./vectorize-service";
import { createContextBuilderService } from "./context-builder-service";
import type { OpenAIMessage } from "../types/openai-types";
import type { RAGConfig } from "../types/rag-types";

export interface RAGServiceDeps {
  ai: Ai;
  r2: R2Bucket;
  vectorize: VectorizeIndex;
}

const DEFAULT_RAG_CONFIG: RAGConfig = {
  enabled: true,
  maxContextTokens: 2000,
  topK: 5,
  similarityThreshold: 0.7,
};

function extractLastUserQuery(messages: OpenAIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content;
    }
  }
  return "";
}

function parseRAGConfig(headers: Record<string, string>): RAGConfig {
  return {
    enabled: headers["x-rag-enabled"] !== "false",
    maxContextTokens: Number(headers["x-rag-max-tokens"]) || DEFAULT_RAG_CONFIG.maxContextTokens,
    topK: Number(headers["x-rag-top-k"]) || DEFAULT_RAG_CONFIG.topK,
    similarityThreshold: Number(headers["x-rag-similarity-threshold"]) || DEFAULT_RAG_CONFIG.similarityThreshold,
  };
}

export interface RAGService {
  enrichMessages(
    messages: OpenAIMessage[],
    ragConfig?: RAGConfig
  ): Promise<{ messages: OpenAIMessage[]; contextUsed: boolean }>;
  parseConfig(headers: Headers): RAGConfig;
}

export function createRAGService(deps: RAGServiceDeps): RAGService {
  const enrichMessages = async (
    messages: OpenAIMessage[],
    ragConfig?: RAGConfig
  ): Promise<{ messages: OpenAIMessage[]; contextUsed: boolean }> => {
    const config = ragConfig ?? DEFAULT_RAG_CONFIG;

    if (!config.enabled) {
      return { messages, contextUsed: false };
    }

    try {
      const query = extractLastUserQuery(messages);

      if (!query) {
        return { messages, contextUsed: false };
      }

      const embeddingService = createEmbeddingService(deps.ai);
      const vectorizeService = createVectorizeService(deps.vectorize);
      const r2Service = createR2StorageService(deps.r2);
      const contextBuilder = createContextBuilderService();

      // Embed query
      const queryVector = await embeddingService.embed(query);

      // Search vector index
      const results = await vectorizeService.query(
        queryVector,
        config.topK,
        config.similarityThreshold
      );

      if (results.length === 0) {
        return { messages, contextUsed: false };
      }

      // Fetch chunk content from R2
      const chunks = await Promise.all(
        results.map(async (r) => {
          const text = await r2Service.getObject(r.metadata.r2_key);
          return {
            r2Key: r.metadata.r2_key,
            chunkIndex: r.metadata.chunk_index,
            text: text ?? "",
          };
        })
      );

      const validChunks = chunks.filter((c) => c.text.length > 0);

      if (validChunks.length === 0) {
        return { messages, contextUsed: false };
      }

      // Build context
      const contextBlock = contextBuilder.buildContext(
        validChunks,
        config.maxContextTokens
      );

      if (!contextBlock) {
        return { messages, contextUsed: false };
      }

      // Inject context as system message (right before the last user message or at the start)
      const enrichedMessages = [...messages];
      const systemIndex = enrichedMessages.findIndex((m) => m.role === "system");

      if (systemIndex >= 0) {
        // Append to existing system message
        enrichedMessages[systemIndex] = {
          ...enrichedMessages[systemIndex],
          content: `${enrichedMessages[systemIndex].content}\n\n${contextBlock}`,
        };
      } else {
        // Insert system message at the beginning
        enrichedMessages.unshift({ role: "system", content: contextBlock });
      }

      return { messages: enrichedMessages, contextUsed: true };
    } catch (err) {
      console.error("RAG enrichment failed, proceeding without context:", err);
      return { messages, contextUsed: false };
    }
  };

  const parseConfig = (headers: Headers): RAGConfig => {
    const entries: Record<string, string> = {};
    headers.forEach((value, key) => {
      entries[key.toLowerCase()] = value;
    });
    return parseRAGConfig(entries);
  };

  return { enrichMessages, parseConfig };
}
