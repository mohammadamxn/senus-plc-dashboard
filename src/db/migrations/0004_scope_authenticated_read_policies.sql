-- Hand-written (no schema.ts diff — pure RLS policy fix, so drizzle-kit
-- generate produces nothing here; same pattern as 0001_enable_pgvector.sql).
--
-- Context: an earlier exploration of "Option A" (RLS scoped via a
-- current_audience() SECURITY DEFINER function reading profiles.audience
-- for auth.uid(), enforced directly on the standard `authenticated`
-- Postgres role that Supabase's JS client/PostgREST use) was applied
-- directly to this database before the project settled on "Option B"
-- (app_runtime + a per-transaction session GUC, see 0003_auth_flow.sql) as
-- the actual enforcement path for report-data reads. Two of those Option A
-- policies were left fully permissive (`USING (true)`) rather than scoped:
--   - statement_lines_read_authenticated: leaked full financial statements
--     to ANY authenticated user regardless of role (credit/equity included)
--     if ever queried through the Supabase client instead of Drizzle.
--   - operating_kpis_read_authenticated: an unrestricted duplicate sitting
--     alongside the already-correct operating_kpis_select_scoped — since
--     RLS SELECT policies are OR'd together, this permissive one silently
--     defeated the scoped one.
-- App code never queries these tables via the `authenticated` role today
-- (report reads go through app_runtime per 0003), so this wasn't
-- exploitable in practice — but leaving a live "USING (true)" policy on
-- financial-statement data is exactly the kind of latent hole
-- defense-in-depth is meant to catch, so it's corrected here rather than
-- left in place now that Option B is the decided architecture.

DROP POLICY IF EXISTS statement_lines_read_authenticated ON statement_lines;--> statement-breakpoint
CREATE POLICY statement_lines_read_authenticated ON statement_lines
  FOR SELECT
  TO authenticated
  USING (current_audience() IN ('management', 'board'));--> statement-breakpoint

DROP POLICY IF EXISTS operating_kpis_read_authenticated ON operating_kpis;
