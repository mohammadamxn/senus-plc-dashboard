ALTER TABLE "source_documents" ADD COLUMN IF NOT EXISTS "storage_path" text;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN IF NOT EXISTS "data_hash" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "insights_period_section_audience" ON "insights" USING btree ("period_id","section","audience");--> statement-breakpoint
CREATE TYPE "public"."insight_job_status" AS ENUM('queued', 'running', 'validating', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insight_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" varchar(64) NOT NULL,
	"section" varchar(64) NOT NULL,
	"audience" varchar(32) NOT NULL,
	"status" "insight_job_status" DEFAULT 'queued' NOT NULL,
	"insight_id" uuid,
	"error" text,
	"model" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "insight_jobs" ADD CONSTRAINT "insight_jobs_period_id_fiscal_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "insight_jobs" ADD CONSTRAINT "insight_jobs_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
