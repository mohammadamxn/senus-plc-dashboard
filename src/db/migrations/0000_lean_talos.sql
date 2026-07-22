CREATE TYPE "public"."basis" AS ENUM('audited', 'unaudited', 'management');--> statement-breakpoint
CREATE TYPE "public"."insight_status" AS ENUM('pending', 'generated', 'approved', 'stale');--> statement-breakpoint
CREATE TYPE "public"."meaningfulness" AS ENUM('ok', 'not_meaningful', 'degenerate');--> statement-breakpoint
CREATE TYPE "public"."period_type" AS ENUM('FY', 'HY', 'Q', 'M');--> statement-breakpoint
CREATE TYPE "public"."statement_type" AS ENUM('PL', 'BS', 'CF');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"registration_number" varchar(32),
	"functional_currency" char(3) DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_chunks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"document_id" varchar(64) NOT NULL,
	"page_ref" text,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_periods" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"company_id" varchar(64) NOT NULL,
	"period_type" "period_type" NOT NULL,
	"label" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"basis" "basis" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "insight_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"metric_value_id" uuid,
	"doc_chunk_id" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" varchar(64) NOT NULL,
	"section" varchar(64) NOT NULL,
	"audience" varchar(32),
	"body" text NOT NULL,
	"status" "insight_status" DEFAULT 'generated' NOT NULL,
	"model" text,
	"prompt_version" varchar(32),
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_item_defs" (
	"code" varchar(64) PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"statement" "statement_type" NOT NULL,
	"parent_code" varchar(64),
	"sort_order" integer NOT NULL,
	"sign_convention" varchar(16) NOT NULL,
	"is_subtotal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_defs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"formula_key" varchar(64) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"audience_tags" text[]
);
--> statement-breakpoint
CREATE TABLE "metric_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_def_id" varchar(64) NOT NULL,
	"period_id" varchar(64) NOT NULL,
	"value" numeric(18, 6),
	"meaningfulness" "meaningfulness" DEFAULT 'ok' NOT NULL,
	"inputs_json" text
);
--> statement-breakpoint
CREATE TABLE "operating_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" varchar(64) NOT NULL,
	"key" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"value" numeric(18, 4) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"basis" "basis" NOT NULL,
	"source_ref" text,
	"tolerance" numeric(18, 4)
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"period_id" varchar(64),
	"title" text NOT NULL,
	"basis" "basis" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" varchar(64) NOT NULL,
	"line_item_code" varchar(64) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doc_chunks" ADD CONSTRAINT "doc_chunks_document_id_source_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_citations" ADD CONSTRAINT "insight_citations_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_citations" ADD CONSTRAINT "insight_citations_metric_value_id_metric_values_id_fk" FOREIGN KEY ("metric_value_id") REFERENCES "public"."metric_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_citations" ADD CONSTRAINT "insight_citations_doc_chunk_id_doc_chunks_id_fk" FOREIGN KEY ("doc_chunk_id") REFERENCES "public"."doc_chunks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_period_id_fiscal_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_metric_def_id_metric_defs_id_fk" FOREIGN KEY ("metric_def_id") REFERENCES "public"."metric_defs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_period_id_fiscal_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_kpis" ADD CONSTRAINT "operating_kpis_period_id_fiscal_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_period_id_fiscal_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_period_id_fiscal_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_line_item_code_line_item_defs_code_fk" FOREIGN KEY ("line_item_code") REFERENCES "public"."line_item_defs"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_periods_company_type_start" ON "fiscal_periods" USING btree ("company_id","period_type","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_values_def_period" ON "metric_values" USING btree ("metric_def_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_lines_period_item" ON "statement_lines" USING btree ("period_id","line_item_code");