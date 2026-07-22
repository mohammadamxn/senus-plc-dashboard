import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

/**
 * Per-request Supabase client for Server Components/Actions/Route Handlers.
 * Reads the session from cookies; setAll is wrapped in try/catch because
 * Server Components cannot set cookies directly — src/proxy.ts is what
 * actually refreshes the session cookie on every request.
 */
export async function createServerSupabaseClient() {
  const env = getEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — safe to ignore because
          // src/proxy.ts refreshes the session cookie on every request.
        }
      },
    },
  });
}
