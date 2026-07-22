-- Remove the chunking pipeline entirely: commentary now cites raw PDF pages
-- (extraction_jobs.raw_text) + verbatim quotes instead of pre-curated doc_chunks.
ALTER TABLE "insight_citations" DROP CONSTRAINT IF EXISTS "insight_citations_doc_chunk_id_doc_chunks_id_fk";--> statement-breakpoint
ALTER TABLE "insight_citations" DROP COLUMN IF EXISTS "doc_chunk_id";--> statement-breakpoint
ALTER TABLE "insight_citations" ADD COLUMN IF NOT EXISTS "page_ref" text;--> statement-breakpoint
ALTER TABLE "insight_citations" ADD COLUMN IF NOT EXISTS "quote" text;--> statement-breakpoint
DROP TABLE IF EXISTS "doc_chunks" CASCADE;
