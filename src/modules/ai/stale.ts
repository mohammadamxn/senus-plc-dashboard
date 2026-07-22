import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insights } from "@/db/schema";

/** Mark all insights for a period as stale after pack re-approve or fact change. */
export async function markInsightsStaleForPeriod(periodId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const updated = await db
    .update(insights)
    .set({ status: "stale" })
    .where(eq(insights.periodId, periodId))
    .returning({ id: insights.id });
  return updated.length;
}
