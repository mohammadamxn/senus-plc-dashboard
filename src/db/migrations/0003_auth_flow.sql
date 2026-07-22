CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"target_user_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "audience" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "operating_kpis" ADD COLUMN "audience_tags" text[];--> statement-breakpoint

-- ============================================================================
-- Auth flow: auth.users -> profiles trigger, RLS, app_runtime role + policies
-- (hand-written below this line; drizzle-kit only generated the table/column
-- diff above. See migration 0002's trailing comment — this is where that
-- deferred trigger/RLS work actually lands.)
-- ============================================================================

-- 1. auth.users -> profiles sync trigger --------------------------------
-- Reads audience/is_admin from the invite's metadata (set by an admin at
-- invite time via supabase.auth.admin.inviteUserByEmail, never something the
-- invitee controls) and creates the matching profiles row the instant the
-- auth.users row exists — there is never a window with an account but no
-- fixed role. SECURITY DEFINER because the trigger fires as Supabase's auth
-- service role, which has no privileges on public.profiles otherwise.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitee_audience audience;
BEGIN
  BEGIN
    invitee_audience := (NEW.raw_user_meta_data->>'audience')::audience;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Unrecognized/missing audience metadata must never abort account
    -- creation (that would lock the invite email itself) — fall back to
    -- NULL, which profiles RLS/app-layer checks treat as "no report access".
    invitee_audience := NULL;
  END;

  INSERT INTO public.profiles (user_id, audience, is_admin, full_name)
  VALUES (
    NEW.id,
    invitee_audience,
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false),
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();--> statement-breakpoint

-- 2. RLS on profiles ------------------------------------------------------
-- A signed-in user may read only their own row; there is deliberately no
-- INSERT/UPDATE/DELETE policy for "authenticated", so no client-side path
-- exists for a user to change their own audience or grant themselves admin.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS profiles_select_own ON profiles;--> statement-breakpoint

CREATE POLICY profiles_select_own ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());--> statement-breakpoint

-- 3. audit_log / rate_limits: deny-by-default for PostgREST ---------------
-- Both tables are only ever written/read via the DATABASE_URL role
-- (BYPASSRLS) from admin Server Actions that have already re-verified
-- is_admin server-side. Enabling RLS with zero policies is a backstop: even
-- if these tables were ever exposed through PostgREST, "authenticated"/
-- "anon" get nothing by default.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- 4. app_runtime role: least-privilege, NOBYPASSRLS, used for all report-
-- data reads at runtime (via RUNTIME_DATABASE_URL) so RLS below is a real
-- enforcement boundary rather than something a superuser-ish connection
-- quietly skips. The password is randomly generated at migration time and
-- never written into this file or version control — copy it from the
-- migration run's NOTICE output into RUNTIME_DATABASE_URL, then discard it.
DO $$
DECLARE
  generated_password text := md5(random()::text || clock_timestamp()::text)
    || md5(random()::text || clock_timestamp()::text);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE format('CREATE ROLE app_runtime LOGIN NOBYPASSRLS PASSWORD %L', generated_password);
    RAISE NOTICE 'app_runtime created — password (copy into RUNTIME_DATABASE_URL, then discard): %', generated_password;
  ELSE
    RAISE NOTICE 'app_runtime already exists — password left unchanged';
  END IF;
END $$;--> statement-breakpoint

GRANT CONNECT ON DATABASE postgres TO app_runtime;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_runtime;--> statement-breakpoint
GRANT SELECT ON
  companies,
  fiscal_periods,
  line_item_defs,
  statement_lines,
  metric_defs,
  metric_values,
  operating_kpis
TO app_runtime;--> statement-breakpoint

-- 5. RLS policies for app_runtime, keyed off a per-transaction session GUC.
-- withAudienceScope() sets app.current_audience via set_config(..., true)
-- (SET LOCAL semantics — transaction-scoped only, so it can never leak
-- across requests sharing a pooled connection) before running any read.
ALTER TABLE metric_values ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS app_runtime_metric_values_select ON metric_values;--> statement-breakpoint
CREATE POLICY app_runtime_metric_values_select ON metric_values
  FOR SELECT
  TO app_runtime
  USING (
    EXISTS (
      SELECT 1 FROM metric_defs md
      WHERE md.id = metric_values.metric_def_id
        AND (
          md.audience_tags IS NULL
          OR current_setting('app.current_audience', true) = ANY (md.audience_tags)
        )
    )
  );--> statement-breakpoint

ALTER TABLE statement_lines ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS app_runtime_statement_lines_select ON statement_lines;--> statement-breakpoint
CREATE POLICY app_runtime_statement_lines_select ON statement_lines
  FOR SELECT
  TO app_runtime
  USING (current_setting('app.current_audience', true) IN ('management', 'board'));--> statement-breakpoint

ALTER TABLE operating_kpis ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS app_runtime_operating_kpis_select ON operating_kpis;--> statement-breakpoint
CREATE POLICY app_runtime_operating_kpis_select ON operating_kpis
  FOR SELECT
  TO app_runtime
  USING (
    audience_tags IS NULL
    OR current_setting('app.current_audience', true) = ANY (audience_tags)
  );