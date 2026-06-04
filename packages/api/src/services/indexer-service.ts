import { createEmbeddingService, EMBEDDING_DIMENSIONS } from "./embedding-service";
import { createR2StorageService } from "./r2-storage-service";
import { createVectorizeService } from "./vectorize-service";

const CHUNK_SIZE = 500; // tokens per chunk
const CHUNK_OVERLAP = 50; // token overlap

export interface IndexerService {
  runIndex(prefix?: string): Promise<{ indexed: number; chunks: number }>;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function chunkText(text: string): string[] {
  const chars: string[] = [];
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const word of words) {
    const wordTokens = estimateTokens(word + " ");

    if (currentTokens + wordTokens > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.join(" "));

      // Keep overlap words
      const overlapTokens: string[] = [];
      let overlapLen = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const t = estimateTokens(current[i] + " ");
        if (overlapLen + t > CHUNK_OVERLAP) break;
        overlapTokens.unshift(current[i]);
        overlapLen += t;
      }
      current = [...overlapTokens];
      currentTokens = overlapLen;
    }

    current.push(word);
    currentTokens += wordTokens;
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

export function createIndexerService(deps: {
  ai: Ai;
  r2: R2Bucket;
  vectorize: VectorizeIndex;
}): IndexerService {
  const runIndex = async (
    prefix?: string
  ): Promise<{ indexed: number; chunks: number }> => {
    const r2Service = createR2StorageService(deps.r2);
    const embeddingService = createEmbeddingService(deps.ai);
    const vectorizeService = createVectorizeService(deps.vectorize);

    const keys = await r2Service.listObjects(prefix);
    let totalIndexed = 0;
    let totalChunks = 0;

    for (const key of keys) {
      const content = await r2Service.getObject(key);
      if (!content) continue;

      const chunks = chunkText(content);

      // Generate embeddings in batch
      const chunkTexts = chunks.map((c) => c.substring(0, 1000)); // trim for embedding
      const vectors = await embeddingService.embedBatch(chunkTexts);

      // Upsert vectors
      for (let i = 0; i < vectors.length; i++) {
        const vectorId = `${key}:chunk:${i}`;
        await vectorizeService.upsert(vectorId, vectors[i], {
          r2_key: key,
          chunk_index: String(i),
          preview: chunks[i].substring(0, 200),
        });
      }

      totalIndexed++;
      totalChunks += chunks.length;
    }

    return { indexed: totalIndexed, chunks: totalChunks };
  };

  return { runIndex };
}

export { chunkText };
