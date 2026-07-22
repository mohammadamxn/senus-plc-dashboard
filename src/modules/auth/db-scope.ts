import "server-only";
import { sql } from "drizzle-orm";
import { getRuntimeDb } from "@/db/runtime-client";
import type { Db } from "@/db/client";
import type { AudienceId } from "@/config/site";

/**
 * Opens a transaction on the app_runtime connection and sets
 * app.current_audience via set_config(..., true) — the `true` (SET LOCAL
 * semantics) is what scopes this to the current transaction only, so it
 * can never leak across requests sharing a pooled backend connection
 * (Supabase's pooler runs in transaction mode: one physical connection per
 * transaction, reused after COMMIT). The RLS policies added in
 * 0003_auth_flow.sql key off exactly this session variable.
 *
 * `fn` receives a Drizzle instance shaped like the regular Db type (the
 * transaction object implements the same query-builder surface used by
 * load-report.ts) so callers don't need a separate code path for
 * "in a transaction" vs "not".
 */
export async function withAudienceScope<T>(
  audience: AudienceId,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  const db = getRuntimeDb();
  if (!db) {
    throw new Error("RUNTIME_DATABASE_URL is not set — cannot scope a report-data read");
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_audience', ${audience}, true)`);
    return fn(tx as unknown as Db);
  });
}
