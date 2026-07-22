import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` (confirmed against
 * node_modules/next/dist/docs). This runs on every matched request to:
 *   1. Refresh the Supabase session cookie (optimistic check only — no DB
 *      query here, per Next.js's own guidance: proxy runs on every request
 *      including prefetches, so it must stay cheap).
 *   2. Redirect unauthenticated requests away from protected routes.
 *   3. Redirect already-authenticated users away from auth pages.
 * Authorization (audience/role checks) happens deeper, in the page/DAL —
 * this is only the coarse, cheap first gate.
 */

// Only routes reachable with NO session at all. /accept-invite and
// /update-password deliberately are NOT here — both require a session
// established by /auth/confirm exchanging an invite/reset token first, so
// they fall through to the "requires a user" branch below like any other
// protected page. /auth/* is a passthrough: its whole job is establishing
// that session, so it must run before any user check.
const PUBLIC_ROUTES = ["/login", "/forgot-password"];
const AUTH_ROUTE_PREFIX = "/auth";

function isPublicPath(pathname: string) {
  return PUBLIC_ROUTES.includes(pathname) || pathname.startsWith(AUTH_ROUTE_PREFIX);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Misconfigured env — fail open on static assets, but block app routes
    // rather than silently serving an unauthenticated app.
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() (not getSession()) re-validates against Supabase Auth rather
  // than trusting a locally-decoded JWT, at the cost of one extra network
  // call — the right trade-off for a proxy that gates every protected route.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/reports/hy2026", request.url));
  }

  // Logged-in users use in-session change password, not the email forgot form.
  if (user && pathname === "/forgot-password") {
    return NextResponse.redirect(new URL("/account/password", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
