// Next.js aliases the real "server-only" package to a no-op in server
// webpack bundles (it only throws when accidentally pulled into a client
// bundle). Vitest runs in plain Node with no such aliasing, so anything
// that imports "server-only" — most of src/modules/auth, src/lib/env.ts,
// src/lib/supabase/server.ts etc. — would throw immediately without this
// stub. See the alias in vitest.config.ts.
export {};
