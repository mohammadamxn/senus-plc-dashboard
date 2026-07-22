import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Returns a Drizzle client when DATABASE_URL is set (remote Supabase).
 * The report UI can run from seed files without a DB for local/demo.
 *
 * Singleton pool: recreating postgres() on every getDb() call leaks
 * connections (each pool holds up to `max` sockets) and eventually hits
 * Supabase's connection limit. Mirror getRuntimeDb().
 */
let sqlClient: ReturnType<typeof postgres> | null = null;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  sqlClient ??= postgres(url, { prepare: false, max: 5 });
  return drizzle(sqlClient, { schema });
}

export type Db = NonNullable<ReturnType<typeof getDb>>;
