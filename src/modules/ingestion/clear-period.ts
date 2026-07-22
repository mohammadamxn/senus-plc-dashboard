import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  insightCitations,
  insights,
  insightJobs,
  metricValues,
  statementLines,
  operatingKpis,
  sourceDocuments,
  extractionDrafts,
  extractionJobs,
} from "@/db/schema";
import { priorPeriodId } from "@/modules/periods/generate";

/**
 * Remove approved facts for a primary report period (option 1: clear by period).
 * Also removes prior-period statement lines written as the comparative column
 * of this pack, unless that prior period was itself loaded as a primary pack
 * (has metric_values).
 */
export async function clearPeriodPack(periodId: string): Promise<{
  clearedComparative: string | null;
}> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");

  const comparativeId = priorPeriodId(periodId);

  // Insight jobs first (FK to insights)
  await db.delete(insightJobs).where(eq(insightJobs.periodId, periodId));

  // Insights for this period
  const periodInsights = await db
    .select({ id: insights.id })
    .from(insights)
    .where(eq(insights.periodId, periodId));
  const insightIds = periodInsights.map((r) => r.id);
  if (insightIds.length > 0) {
    await db.delete(insightCitations).where(inArray(insightCitations.insightId, insightIds));
    await db.delete(insights).where(eq(insights.periodId, periodId));
  }

  // Citations pointing at this period's metric values
  const periodMetrics = await db
    .select({ id: metricValues.id })
    .from(metricValues)
    .where(eq(metricValues.periodId, periodId));
  const metricIds = periodMetrics.map((r) => r.id);
  if (metricIds.length > 0) {
    await db.delete(insightCitations).where(inArray(insightCitations.metricValueId, metricIds));
  }

  await db.delete(metricValues).where(eq(metricValues.periodId, periodId));
  await db.delete(statementLines).where(eq(statementLines.periodId, periodId));
  await db.delete(operatingKpis).where(eq(operatingKpis.periodId, periodId));

  await db.delete(sourceDocuments).where(eq(sourceDocuments.periodId, periodId));

  const jobs = await db
    .select({ id: extractionJobs.id })
    .from(extractionJobs)
    .where(eq(extractionJobs.periodId, periodId));
  const jobIds = jobs.map((j) => j.id);
  if (jobIds.length > 0) {
    await db.delete(extractionDrafts).where(inArray(extractionDrafts.jobId, jobIds));
    await db.delete(extractionJobs).where(eq(extractionJobs.periodId, periodId));
  }

  let clearedComparative: string | null = null;
  if (comparativeId) {
    const [asPrimary] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(metricValues)
      .where(eq(metricValues.periodId, comparativeId));
    // Prior column only — not its own approved pack
    if ((asPrimary?.n ?? 0) === 0) {
      await db.delete(statementLines).where(eq(statementLines.periodId, comparativeId));
      await db.delete(operatingKpis).where(eq(operatingKpis.periodId, comparativeId));
      clearedComparative = comparativeId;
    }
  }

  return { clearedComparative };
}
