import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

/**
 * Service-role Supabase client — bypasses RLS entirely. Server-only, and
 * must only ever be used inside admin Server Actions that have already
 * re-verified the caller's is_admin flag from their own session/profile.
 * Never import this into a Client Component; the service-role key must
 * never reach the browser.
 */
export function createAdminSupabaseClient() {
  const env = getEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — required for admin operations");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
