import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insightCitations, insights, metricValues } from "@/db/schema";
import type { CommentaryOutput, MetricContextItem } from "@/modules/ai/validate";
import type { CategoryId } from "@/config/metric-categories";

export async function persistInsight(args: {
  periodId: string;
  section: CategoryId;
  body: string;
  output: CommentaryOutput;
  metrics: MetricContextItem[];
  dataHash: string;
  promptVersion: string;
  model: string;
  status?: "generated" | "pending" | "approved";
}): Promise<string> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");

  const status = args.status ?? "generated";

  const existing = await db
    .select({ id: insights.id })
    .from(insights)
    .where(and(eq(insights.periodId, args.periodId), eq(insights.section, args.section)))
    .limit(1);

  let insightId: string;
  if (existing[0]) {
    insightId = existing[0].id;
    await db
      .update(insights)
      .set({
        body: args.body,
        audience: null,
        status,
        model: args.model,
        promptVersion: args.promptVersion,
        dataHash: args.dataHash,
        generatedAt: new Date(),
      })
      .where(eq(insights.id, insightId));
    await db.delete(insightCitations).where(eq(insightCitations.insightId, insightId));
  } else {
    const [row] = await db
      .insert(insights)
      .values({
        periodId: args.periodId,
        section: args.section,
        audience: null,
        body: args.body,
        status,
        model: args.model,
        promptVersion: args.promptVersion,
        dataHash: args.dataHash,
      })
      .returning({ id: insights.id });
    insightId = row!.id;
  }

  const metricDefToValue = new Map(
    args.metrics.map((m) => [m.metricDefId, m.metricValueId] as const),
  );
  const valueIds = new Set(args.metrics.map((m) => m.metricValueId));

  for (const cite of args.output.metricCitationIds) {
    let metricValueId = valueIds.has(cite) ? cite : metricDefToValue.get(cite);
    if (!metricValueId) {
      const [mv] = await db
        .select({ id: metricValues.id })
        .from(metricValues)
        .where(
          and(eq(metricValues.periodId, args.periodId), eq(metricValues.metricDefId, cite)),
        )
        .limit(1);
      metricValueId = mv?.id;
    }
    if (!metricValueId) continue;
    await db.insert(insightCitations).values({
      insightId,
      metricValueId,
      pageRef: null,
      quote: null,
    });
  }

  for (const pageCite of args.output.pageCitations) {
    await db.insert(insightCitations).values({
      insightId,
      metricValueId: null,
      pageRef: pageCite.pageRef,
      quote: pageCite.quote,
    });
  }

  return insightId;
}

export async function updateInsightBody(insightId: string, body: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  await db.update(insights).set({ body }).where(eq(insights.id, insightId));
}

export async function setInsightStatus(
  insightId: string,
  status: "pending" | "generated" | "approved" | "stale",
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.update(insights).set({ status }).where(eq(insights.id, insightId));
}

/** Delete all insights for a period (e.g. before regenerating pack). */
export async function deleteInsightsForPeriod(periodId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const rows = await db
    .select({ id: insights.id })
    .from(insights)
    .where(eq(insights.periodId, periodId));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;
  for (const id of ids) {
    await db.delete(insightCitations).where(eq(insightCitations.insightId, id));
  }
  await db.delete(insights).where(eq(insights.periodId, periodId));
}

export async function findInsightBySection(periodId: string, section: CategoryId) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(insights)
    .where(and(eq(insights.periodId, periodId), eq(insights.section, section)))
    .limit(1);
  return row ?? null;
}
