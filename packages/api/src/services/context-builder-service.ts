import type { ChunkContent } from "../types/rag-types";

export interface ContextBuilderService {
  buildContext(chunks: ChunkContent[], tokenBudget: number): string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function createContextBuilderService(): ContextBuilderService {
  const buildContext = (chunks: ChunkContent[], tokenBudget: number): string => {
    const sections: string[] = [];
    let usedTokens = 0;

    for (const chunk of chunks) {
      const section = `[Source: ${chunk.r2Key}]\n${chunk.text}`;
      const sectionTokens = estimateTokens(section) + estimateTokens("---\n");

      if (usedTokens + sectionTokens > tokenBudget) break;

      sections.push(section);
      usedTokens += sectionTokens;
    }

    if (sections.length === 0) return "";

    return (
      "Here is relevant context information:\n\n" +
      sections.join("\n---\n") +
      "\n---\n\nUse the above context to answer the user's question. If the context doesn't contain relevant information, rely on your own knowledge."
    );
  };

  return { buildContext };
}

export { estimateTokens };
