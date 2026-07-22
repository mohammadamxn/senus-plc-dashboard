CREATE TYPE "public"."extraction_source_kind" AS ENUM('hy_interim', 'fy_chairman');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'extracted', 'approved', 'rejected', 'failed');--> statement-breakpoint
CREATE TABLE "extraction_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"model" text,
	"prompt_version" varchar(32) DEFAULT 'v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" varchar(64) NOT NULL,
	"comparative_period_id" varchar(64),
	"source_kind" "extraction_source_kind" NOT NULL,
	"status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"source_filename" text,
	"raw_text" text,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extraction_drafts" ADD CONSTRAINT "extraction_drafts_job_id_extraction_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."extraction_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_period_id_fiscal_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_comparative_period_id_fiscal_periods_id_fk" FOREIGN KEY ("comparative_period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;