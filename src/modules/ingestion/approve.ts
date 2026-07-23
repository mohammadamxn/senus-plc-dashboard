import "server-only";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  statementLines,
  operatingKpis,
  sourceDocuments,
  metricDefs,
  metricValues,
  extractionJobs,
  extractionDrafts,
  documentSections,
} from "@/db/schema";
import {
  normalizeQualitativeSections,
  type ExtractionPayload,
} from "@/modules/ingestion/schema";
import { computeMetrics, type StatementAmounts } from "@/modules/metrics/engine";
import {
  buildMetricAudienceTags,
  LIQUIDITY_OPERATING_KPI_KEYS,
  CATEGORY_AUDIENCES,
} from "@/config/metric-categories";

function payloadToStatementAmounts(payload: ExtractionPayload): StatementAmounts {
  const lines: StatementAmounts = {};
  for (const row of payload.statementLines) {
    lines[row.code] = { current: row.current, prior: row.prior };
  }
  return lines;
}

/** Stable document id per HY pack so re-approve updates the same source_documents row. */
export function hyInterimDocumentId(periodId: string): string {
  return `hy-interim-${periodId}`;
}

/**
 * Persist approved financial facts and run the deterministic metrics engine.
 * Does not write qualitative sections — that is a second human-approve step.
 * Sets job status to financials_approved.
 */
export async function approveExtractionFinancials(args: {
  jobId: string;
  payload: ExtractionPayload;
}): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");

  const { jobId, payload } = args;
  const periodId = payload.periodId;
  const comparativePeriodId = payload.comparativePeriodId;

  for (const row of payload.statementLines) {
    await db
      .insert(statementLines)
      .values({
        periodId,
        lineItemCode: row.code,
        amount: row.current.toFixed(2),
        currency: "EUR",
      })
      .onConflictDoUpdate({
        target: [statementLines.periodId, statementLines.lineItemCode],
        set: { amount: row.current.toFixed(2) },
      });

    if (comparativePeriodId) {
      await db
        .insert(statementLines)
        .values({
          periodId: comparativePeriodId,
          lineItemCode: row.code,
          amount: row.prior.toFixed(2),
          currency: "EUR",
        })
        .onConflictDoUpdate({
          target: [statementLines.periodId, statementLines.lineItemCode],
          set: { amount: row.prior.toFixed(2) },
        });
    }
  }

  const liquidityAudiences = CATEGORY_AUDIENCES.liquidity;
  for (const k of payload.operatingKpis) {
    const audienceTags = LIQUIDITY_OPERATING_KPI_KEYS.has(k.key) ? liquidityAudiences : null;
    await db
      .delete(operatingKpis)
      .where(and(eq(operatingKpis.periodId, k.periodId), eq(operatingKpis.key, k.key)));
    await db.insert(operatingKpis).values({
      periodId: k.periodId,
      key: k.key,
      label: k.label,
      value: k.value.toFixed(4),
      unit: k.unit,
      basis: k.basis,
      sourceRef: k.sourceRef,
      audienceTags,
    });
  }

  const docId = hyInterimDocumentId(periodId);
  await db
    .insert(sourceDocuments)
    .values({
      id: docId,
      periodId,
      title: payload.documentTitle,
      basis: payload.basis,
      storagePath: payload.storagePath ?? null,
    })
    .onConflictDoUpdate({
      target: sourceDocuments.id,
      set: {
        title: payload.documentTitle,
        basis: payload.basis,
        storagePath: payload.storagePath ?? null,
      },
    });

  const legacyDocs = await db
    .select({ id: sourceDocuments.id })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.periodId, periodId));
  const legacyIds = legacyDocs.map((d) => d.id).filter((id) => id !== docId);
  if (legacyIds.length > 0) {
    await db.delete(sourceDocuments).where(inArray(sourceDocuments.id, legacyIds));
  }

  const lines = payloadToStatementAmounts(payload);
  const audienceTagsByMetric = buildMetricAudienceTags();
  const metrics = computeMetrics(lines);
  for (const m of metrics) {
    const audienceTags = audienceTagsByMetric[m.id] ?? null;
    await db
      .insert(metricDefs)
      .values({ id: m.id, label: m.label, formulaKey: m.id, unit: m.unit, audienceTags })
      .onConflictDoUpdate({
        target: metricDefs.id,
        set: { label: m.label, unit: m.unit, audienceTags },
      });

    await db
      .insert(metricValues)
      .values({
        metricDefId: m.id,
        periodId,
        value: m.value != null ? m.value.toString() : null,
        meaningfulness: m.meaningfulness,
        inputsJson: JSON.stringify(m.inputs),
      })
      .onConflictDoUpdate({
        target: [metricValues.metricDefId, metricValues.periodId],
        set: {
          value: m.value != null ? m.value.toString() : null,
          meaningfulness: m.meaningfulness,
          inputsJson: JSON.stringify(m.inputs),
        },
      });
  }

  await db
    .update(extractionJobs)
    .set({ status: "financials_approved", updatedAt: new Date(), error: null })
    .where(eq(extractionJobs.id, jobId));
}

/**
 * Persist approved verbatim qualitative section bodies. Requires financials
 * already approved. Sets job status to approved.
 */
export async function approveExtractionQualitative(args: {
  jobId: string;
  payload: ExtractionPayload;
}): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");

  const { jobId, payload } = args;
  const periodId = payload.periodId;
  const sections = normalizeQualitativeSections(payload.qualitativeSections);
  const now = new Date();

  for (const section of sections) {
    await db
      .insert(documentSections)
      .values({
        periodId,
        key: section.key,
        sourceHeading: section.sourceHeading,
        body: section.body,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [documentSections.periodId, documentSections.key],
        set: {
          sourceHeading: section.sourceHeading,
          body: section.body,
          updatedAt: now,
        },
      });
  }

  await db
    .update(extractionJobs)
    .set({ status: "approved", updatedAt: now, error: null })
    .where(eq(extractionJobs.id, jobId));
}

/** @deprecated Use approveExtractionFinancials — kept name for older imports. */
export async function approveExtractionPayload(args: {
  jobId: string;
  payload: ExtractionPayload;
}): Promise<void> {
  return approveExtractionFinancials(args);
}

export async function getLatestDraftForJob(jobId: string) {
  const db = getDb();
  if (!db) return null;
  const [draft] = await db
    .select()
    .from(extractionDrafts)
    .where(eq(extractionDrafts.jobId, jobId))
    .limit(1);
  return draft ?? null;
}
