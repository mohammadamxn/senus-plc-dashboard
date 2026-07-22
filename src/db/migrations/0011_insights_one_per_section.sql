-- Clear obsolete per-audience insight jobs, then collapse to one insight per section.
DELETE FROM insight_jobs;--> statement-breakpoint
DELETE FROM insight_citations
WHERE insight_id IN (
  SELECT id FROM insights i
  WHERE i.id NOT IN (
    SELECT DISTINCT ON (period_id, section) id
    FROM insights
    ORDER BY period_id, section, generated_at DESC NULLS LAST
  )
);--> statement-breakpoint
DELETE FROM insights
WHERE id NOT IN (
  SELECT DISTINCT ON (period_id, section) id
  FROM insights
  ORDER BY period_id, section, generated_at DESC NULLS LAST
);--> statement-breakpoint
UPDATE insights SET audience = NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "insights_period_section_audience";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "insights_period_section" ON "insights" USING btree ("period_id","section");
