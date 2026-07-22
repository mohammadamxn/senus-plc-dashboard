import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AudienceId } from "@/config/site";

export type CurrentProfile = {
  userId: string;
  email: string | null;
  audience: AudienceId | null;
  isAdmin: boolean;
  fullName: string | null;
};

/**
 * React `cache()` de-dupes this per request — every Server Component on a
 * page can call getCurrentProfile() without triggering repeat round-trips.
 * Reads through the per-request Supabase client (the "authenticated" role +
 * profiles' own RLS: a user may only ever select their own row), NOT
 * Drizzle/app_runtime — this is identity/session data, not report data.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("audience, is_admin, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    audience: (profile?.audience as AudienceId | null) ?? null,
    isAdmin: profile?.is_admin ?? false,
    fullName: profile?.full_name ?? null,
  };
});

export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
