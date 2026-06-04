import type { VectorSearchResult } from "../types/rag-types";

export interface VectorizeService {
  query(vector: number[], topK: number, threshold: number): Promise<VectorSearchResult[]>;
  upsert(id: string, vector: number[], metadata: Record<string, string>): Promise<void>;
}

export function createVectorizeService(index: VectorizeIndex): VectorizeService {
  const query = async (
    vector: number[],
    topK: number,
    threshold: number
  ): Promise<VectorSearchResult[]> => {
    const results = await index.query(vector, {
      topK,
      returnValues: false,
      returnMetadata: "all",
    });

    return results.matches
      .filter((m) => m.score >= threshold)
      .map((m) => ({
        id: m.id,
        score: m.score,
        metadata: {
          r2_key: (m.metadata?.r2_key as string) ?? "",
          chunk_index: Number(m.metadata?.chunk_index ?? 0),
          preview: (m.metadata?.preview as string) ?? "",
        },
      }));
  };

  const upsert = async (
    id: string,
    vector: number[],
    metadata: Record<string, string>
  ): Promise<void> => {
    await index.upsert([
      {
        id,
        values: vector,
        metadata,
      },
    ]);
  };

  return { query, upsert };
}
