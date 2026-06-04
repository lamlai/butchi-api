export interface RAGConfig {
  enabled: boolean;
  maxContextTokens: number;
  topK: number;
  similarityThreshold: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    r2_key: string;
    chunk_index: number;
    preview: string;
  };
}

export interface ChunkContent {
  r2Key: string;
  chunkIndex: number;
  text: string;
}
