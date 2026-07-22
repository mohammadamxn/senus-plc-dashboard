-- Hand-written, no schema.ts diff (pure RLS policy fix).
--
-- 0003_auth_flow.sql restricted statement_lines to management/board for
-- BOTH the app_runtime role and the authenticated role. That's correct for
-- `authenticated` (nothing in the app queries statement_lines that way, and
-- if it ever did, it should only ever be for rendering the literal raw P&L/
-- BS/CF statement — management/board only, per spec).
--
-- It's wrong for `app_runtime`: load-report.ts's DB path computes EVERY
-- metric and chart (Growth, Profitability, Liquidity, Solvency, Returns —
-- categories explicitly granted to credit/equity too) from the same raw
-- statement_lines rows via computeMetrics(lines). A whole-table
-- management/board-only block on statement_lines silently zeroed out every
-- number for credit/equity, breaking metrics those audiences are supposed
-- to see, not just the raw statement view.
--
-- Fix: app_runtime can read statement_lines for any *recognized* audience
-- (fail-closed if the GUC is ever unset — e.g. a bug that reads outside
-- withAudienceScope() — rather than open). The actual "raw financial
-- statements are management/board only" boundary is enforced at the
-- application layer (report page hides the Financial Statements section
-- for other audiences) and, independently, by metric_values/operating_kpis
-- RLS (per-metric audience_tags) — those are the two real DB-level
-- boundaries for what a non-management/board audience's report actually
-- renders.
DROP POLICY IF EXISTS app_runtime_statement_lines_select ON statement_lines;--> statement-breakpoint
CREATE POLICY app_runtime_statement_lines_select ON statement_lines
  FOR SELECT
  TO app_runtime
  USING (
    current_setting('app.current_audience', true) = ANY (ARRAY['management', 'board', 'equity', 'credit'])
  );
