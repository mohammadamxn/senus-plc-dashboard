import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Least-privilege connection (RUNTIME_DATABASE_URL -> app_runtime role,
 * NOBYPASSRLS) used for ALL report-data reads at request time, so the RLS
 * policies from migration 0003 are a real enforcement boundary rather than
 * something the powerful DATABASE_URL role would silently bypass. Only
 * reached through withAudienceScope() (src/modules/auth/db-scope.ts), never
 * directly — a bare query on this connection with no audience GUC set
 * would see zero rows on every audience-scoped table, by design (fail
 * closed, not open).
 */
let sqlClient: ReturnType<typeof postgres> | null = null;

export function getRuntimeDb() {
  const url = process.env.RUNTIME_DATABASE_URL;
  if (!url) return null;
  sqlClient ??= postgres(url, { prepare: false, max: 5 });
  return drizzle(sqlClient, { schema });
}

export type RuntimeDb = NonNullable<ReturnType<typeof getRuntimeDb>>;
