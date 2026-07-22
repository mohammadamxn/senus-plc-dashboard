import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insightCitations, insights, metricDefs, metricValues } from "@/db/schema";
import type { CategoryId } from "@/config/metric-categories";

export type LoadedInsight = {
  id: string;
  periodId: string;
  section: string;
  audience: string | null;
  body: string;
  status: "pending" | "generated" | "approved" | "stale";
  model: string | null;
  generatedAt: Date;
  citations: {
    metricLabel: string | null;
    metricDefId: string | null;
    pageRef: string | null;
    quote: string | null;
  }[];
};

async function hydrateInsight(row: typeof insights.$inferSelect): Promise<LoadedInsight> {
  const db = getDb();
  if (!db) {
    return {
      id: row.id,
      periodId: row.periodId,
      section: row.section,
      audience: row.audience,
      body: row.body,
      status: row.status,
      model: row.model,
      generatedAt: row.generatedAt,
      citations: [],
    };
  }

  const cites = await db
    .select({
      metricValueId: insightCitations.metricValueId,
      metricDefId: metricValues.metricDefId,
      metricLabel: metricDefs.label,
      pageRef: insightCitations.pageRef,
      quote: insightCitations.quote,
    })
    .from(insightCitations)
    .leftJoin(metricValues, eq(metricValues.id, insightCitations.metricValueId))
    .leftJoin(metricDefs, eq(metricDefs.id, metricValues.metricDefId))
    .where(eq(insightCitations.insightId, row.id));

  return {
    id: row.id,
    periodId: row.periodId,
    section: row.section,
    audience: row.audience,
    body: row.body,
    status: row.status,
    model: row.model,
    generatedAt: row.generatedAt,
    citations: cites.map((c) => ({
      metricLabel: c.metricLabel,
      metricDefId: c.metricDefId,
      pageRef: c.pageRef,
      quote: c.quote,
    })),
  };
}

export async function loadInsightsForPeriod(
  periodId: string,
  opts?: { includeStatuses?: LoadedInsight["status"][] },
): Promise<LoadedInsight[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(insights)
    .where(eq(insights.periodId, periodId))
    .orderBy(desc(insights.generatedAt));

  const filtered = rows.filter((r) => {
    if (opts?.includeStatuses && !opts.includeStatuses.includes(r.status)) return false;
    return true;
  });

  // One row per section (prefer newest if duplicates remain)
  const bySection = new Map<string, (typeof rows)[number]>();
  for (const row of filtered) {
    if (!bySection.has(row.section)) bySection.set(row.section, row);
  }

  const result: LoadedInsight[] = [];
  for (const row of bySection.values()) {
    result.push(await hydrateInsight(row));
  }
  return result;
}

export async function loadInsightForSection(
  periodId: string,
  section: CategoryId,
): Promise<LoadedInsight | null> {
  const all = await loadInsightsForPeriod(periodId);
  return all.find((i) => i.section === section) ?? null;
}

export async function listInsightsAdmin(periodId: string): Promise<LoadedInsight[]> {
  return loadInsightsForPeriod(periodId);
}

export async function approveInsight(insightId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  await db.update(insights).set({ status: "approved" }).where(eq(insights.id, insightId));
}

export async function approveAllGeneratedInsights(periodId: string): Promise<number> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  const updated = await db
    .update(insights)
    .set({ status: "approved" })
    .where(and(eq(insights.periodId, periodId), eq(insights.status, "generated")))
    .returning({ id: insights.id });
  return updated.length;
}
