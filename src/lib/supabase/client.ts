import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Only the anon key is ever shipped here.
 * Deliberately does not import src/lib/env.ts (which is `server-only` and
 * would break client bundling) — NEXT_PUBLIC_* vars are inlined by Next.js
 * at build time regardless, so a plain process.env read is correct here.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set");
  }
  return createBrowserClient(url, anonKey);
}
