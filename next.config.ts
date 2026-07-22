import type { NextConfig } from "next";

// Set to the real deploy domain(s) once known, e.g. ["senus-board.example.com"].
// Locking this explicitly (rather than relying on Next's inferred same-origin
// default) defends the Server Actions' built-in Origin/CSRF check against
// misconfiguration if the app is ever placed behind a proxy/custom domain.
const allowedOrigins = process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(",").filter(Boolean);

// Next's dev server (Fast Refresh/Turbopack HMR) uses eval() for source-map
// and stack-trace reconstruction — harmless in dev, but a real risk in
// production, so 'unsafe-eval' is only ever added outside NODE_ENV=production.
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Playwright hits 127.0.0.1 while `next dev` is often bound to localhost —
  // allow both so client bundles / HMR are not blocked in e2e.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    ...(allowedOrigins && allowedOrigins.length > 0
      ? { serverActions: { allowedOrigins, bodySizeLimit: "12mb" } }
      : { serverActions: { bodySizeLimit: "12mb" } }),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
