-- Two-step approve: financials_approved, then qualitative sections → approved.
ALTER TYPE "public"."extraction_status" ADD VALUE IF NOT EXISTS 'financials_approved';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_id" varchar(64) NOT NULL,
  "key" varchar(64) NOT NULL,
  "source_heading" text DEFAULT '' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "document_sections"
    ADD CONSTRAINT "document_sections_period_id_fiscal_periods_id_fk"
    FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "document_sections_period_key_uidx"
  ON "document_sections" ("period_id", "key");
