import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Exchanges the token_hash from an invite/recovery email link for a
// session. `next` is attacker-controllable (it's a query param on a public
// link) — an open redirect here would let a phished link on this domain
// bounce a real session to an attacker-controlled path, so it's validated
// against a fixed allow-list rather than followed as-is.
const ALLOWED_NEXT_PATHS = new Set([
  "/accept-invite",
  "/update-password",
  "/set-password",
  "/reports/hy2026",
]);

function defaultNextFor(type: EmailOtpType | null): string {
  if (type === "invite") return "/accept-invite";
  if (type === "recovery") return "/update-password";
  return "/reports/hy2026";
}

function resolveNext(requestedNext: string | null, type: EmailOtpType | null): string {
  const candidate =
    requestedNext && ALLOWED_NEXT_PATHS.has(requestedNext) ? requestedNext : defaultNextFor(type);
  // Older invite emails used /set-password; that route only redirects here.
  if (candidate === "/set-password") return "/accept-invite";
  return candidate;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = resolveNext(searchParams.get("next"), type);

  if (tokenHash && type) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link_expired", origin));
}
