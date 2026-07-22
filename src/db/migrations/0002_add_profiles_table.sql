CREATE TYPE "public"."audience" AS ENUM('management', 'board', 'equity', 'credit');--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"audience" "audience" NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"full_name" text,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL
);
-- NOTE: doc_chunks.embedding already exists (added by 0001_enable_pgvector.sql by hand,
-- outside drizzle-kit's tracked snapshot) — the auto-generated ALTER for it was removed here.