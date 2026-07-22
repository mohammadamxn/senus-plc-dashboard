-- pgvector: doc_chunks embeddings live in the same transactional store as the
-- metrics they help narrate (blueprint §3 data layer rationale).
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "doc_chunks" ADD COLUMN "embedding" vector(1536);

-- Cosine distance index for nearest-neighbour retrieval over chunk embeddings.
CREATE INDEX IF NOT EXISTS "doc_chunks_embedding_idx"
  ON "doc_chunks" USING hnsw ("embedding" vector_cosine_ops);
