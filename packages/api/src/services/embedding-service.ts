const EMBEDDING_MODEL = "@cf/bge-base-en-v1.5";
const EMBEDDING_DIMENSIONS = 768;

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export function createEmbeddingService(ai: Ai): EmbeddingService {
function extractEmbeddings(result: unknown): number[][] {
  const data = (result as { data: unknown }).data;
  if (!Array.isArray(data) || !data.length) {
    throw new Error("Embedding API returned unexpected response shape");
  }
  return data as number[][];
}

  const embed = async (text: string): Promise<number[]> => {
    const result = await ai.run(EMBEDDING_MODEL, {
      text: [text],
    });
    return extractEmbeddings(result)[0];
  };

  const embedBatch = async (texts: string[]): Promise<number[][]> => {
    const results: number[][] = [];

    // Process in batches of 10 to avoid Workers AI limits
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const result = await ai.run(EMBEDDING_MODEL, {
        text: batch,
      });
      results.push(...extractEmbeddings(result));
    }

    return results;
  };

  return { embed, embedBatch };
}

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL };
