import "server-only";
import { z } from "zod";

/**
 * Fail-fast env validation: misconfiguration surfaces as a clear boot-time
 * error instead of an obscure runtime failure deep inside a request. Parsed
 * once per process (module-level singleton).
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (migrations/seed/admin connection)"),
  RUNTIME_DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid/missing environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
