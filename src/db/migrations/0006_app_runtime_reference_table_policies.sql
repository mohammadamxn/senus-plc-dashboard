-- Hand-written, no schema.ts diff (pure RLS policy fix).
--
-- companies, fiscal_periods, line_item_defs, and metric_defs already had
-- RLS enabled (from the earlier "Option A" exploration, see
-- 0004_scope_authenticated_read_policies.sql) with a permissive policy for
-- the `authenticated` role only. 0003_auth_flow.sql granted app_runtime
-- SELECT on these tables but never added a matching RLS policy for it —
-- and a role with a table-level grant but no matching RLS policy still
-- gets zero rows once RLS is enabled. That silently broke every report
-- read for every audience (these four tables are unconditionally read by
-- load-report.ts regardless of audience — they carry no audience dimension
-- of their own, e.g. company name, period labels, chart-of-accounts
-- labels, metric definitions text/unit).
CREATE POLICY app_runtime_companies_select ON companies
  FOR SELECT TO app_runtime USING (true);--> statement-breakpoint

CREATE POLICY app_runtime_fiscal_periods_select ON fiscal_periods
  FOR SELECT TO app_runtime USING (true);--> statement-breakpoint

CREATE POLICY app_runtime_line_item_defs_select ON line_item_defs
  FOR SELECT TO app_runtime USING (true);--> statement-breakpoint

CREATE POLICY app_runtime_metric_defs_select ON metric_defs
  FOR SELECT TO app_runtime USING (true);
