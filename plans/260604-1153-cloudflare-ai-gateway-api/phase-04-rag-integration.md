---
phase: 4
title: "RAG Integration"
status: pending
priority: P1
effort: "3h"
dependencies: [3]
---

# Phase 4: RAG Integration

## Overview

Tích hợp RAG layer với vector search: embed user query bằng Workers AI, query Cloudflare Vectorize cho relevant chunks, lấy original text từ R2, inject context vào prompt trước khi forward qua AI Gateway.

## Requirements

- Functional: Vector search cho relevant context, tự động inject vào mọi request
- Non-functional: RAG query < 100ms (embedding + vector search), context window không exceed model limit

## Architecture

```
RAG Flow:
1. Extract user query từ request messages
2. Embed query bằng Workers AI (@cf/bge-base-en-v1.5)
3. Query Cloudflare Vectorize cho top-k similar chunks
4. Fetch original text từ R2 (flat bucket, prefix-based)
5. Build system prompt với injected context
6. Forward enriched request to AI Gateway

Data Pipeline (one-time setup):
1. Raw text files trên R2 (flat, prefix-based)
2. Chunk documents → store chunks metadata
3. Embed chunks bằng Workers AI
4. Store vectors trong Cloudflare Vectorize
5. Vector ID → R2 object key mapping
```

## Related Code Files

- Create: `packages/api/src/services/rag-service.ts`
- Create: `packages/api/src/services/r2-storage-service.ts`
- Create: `packages/api/src/services/embedding-service.ts`
- Create: `packages/api/src/services/vectorize-service.ts`
- Create: `packages/api/src/services/context-builder-service.ts`
- Create: `packages/api/src/services/indexer-service.ts`
- Create: `packages/api/src/types/rag-types.ts`

## Implementation Steps

1. Setup Cloudflare Vectorize index:
   - Create index với dimension 768 (bge-base-en-v1.5)
   - Configure in wrangler.toml
2. Implement embedding service:
   - Use Workers AI `@cf/bge-base-en-v1.5` model
   - Embed single query → vector
   - Embed batch (for indexing) → vectors
3. Implement R2 storage service:
   - List objects in bucket (flat, prefix-based)
   - Get object content by key
   - Parse text content từ raw files
4. Implement indexer service (one-time/batch job):
   - Read all raw text files từ R2
   - Chunk documents (500 tokens per chunk, 50 token overlap)
   - Embed chunks via Workers AI
   - Upsert vectors into Vectorize (metadata: r2_key, chunk_index, preview)
5. Implement vectorize service:
   - Query Vectorize with embedding vector
   - Return top-k results (default k=5)
   - Filter by similarity threshold (> 0.7)
6. Implement context builder service:
   - Take vector search results
   - Fetch full text chunks từ R2
   - Build system prompt injection
   - Respect token budget (max context = model_limit - user_tokens - buffer)
   - Truncate if exceeds budget
7. Implement RAG service (orchestrator):
   - Extract query từ user messages (last user message)
   - Call embedding service → query vector
   - Call vectorize service → relevant chunk IDs
   - Call R2 → fetch chunk content
   - Call context builder → enriched messages
8. Integrate RAG into API gateway flow:
   - After request parsing, before gateway forward
   - Call RAG service → get enriched messages
   - Forward enriched request
9. Add RAG config options:
   - Enable/disable per request (header: `X-RAG-Enabled: true/false`)
   - Max context tokens (default: 2000)
   - Top-k results (default: 5)
   - Similarity threshold (default: 0.7)

## Success Criteria

- [x] Indexer chunking + embedding raw text files từ R2 thành công
- [x] Vectors stored trong Cloudflare Vectorize
- [x] Vector search trả relevant chunks cho query
- [x] Context injected đúng vào system prompt
- [x] Token budget respected (không exceed model limit)
- [x] RAG có thể disable per-request via header
- [ ] Latency overhead < 100ms cho full RAG pipeline (cần production measurement)
- [x] Graceful fallback nếu Vectorize/R2 query fails (proceed without RAG)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Vectorize cold start latency | Warm queries, caching popular embeddings |
| Context too large | Token budget calculation, truncation strategy |
| Irrelevant context injection | Similarity threshold (0.7), top-k limit |
| Embedding model accuracy | Use bge-base-en-v1.5 (well-tested), monitor retrieval quality |
| R2 flat structure hard to navigate | Consistent prefix naming, metadata in Vectorize |
| Indexer re-run needed on data change | Expose `/api/admin/reindex` endpoint (protected) |
