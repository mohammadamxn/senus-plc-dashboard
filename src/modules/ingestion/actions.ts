"use server";

import "server-only";
import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  extractionJobs,
  extractionDrafts,
  statementLines,
  operatingKpis,
  fiscalPeriods,
  metricValues,
  auditLog,
} from "@/db/schema";
import { getCurrentProfile } from "@/modules/auth/session";
import { pdfBufferToText } from "@/modules/ingestion/pdf";
import { extractStructuredFromText, PROMPT_VERSION } from "@/modules/ingestion/extract";
import { approveExtractionFinancials, approveExtractionQualitative } from "@/modules/ingestion/approve";
import { extractionPayloadSchema } from "@/modules/ingestion/schema";
import { loadChartOfAccounts } from "@/modules/ingestion/chart";
import { normalizeExtractionPayload } from "@/modules/ingestion/normalize-lines";
import { priorPeriodId, periodsFrom } from "@/modules/periods/generate";
import { clearPeriodPack } from "@/modules/ingestion/clear-period";
import { markInsightsStaleForPeriod } from "@/modules/ai/stale";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type IngestActionResult =
  | { error: string }
  | { success: string; jobId?: string };

export type AvailableReportPeriod = {
  id: string;
  label: string;
  basis: string;
  periodType: string;
};

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.isAdmin) throw new Error("Forbidden");
  return profile;
}

export async function countStatementLines(periodId?: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  if (periodId) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(statementLines)
      .where(eq(statementLines.periodId, periodId));
    return row?.n ?? 0;
  }
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(statementLines);
  return row?.n ?? 0;
}

/**
 * Primary approved packs only (have calculated metric_values).
 * Comparative-only periods (e.g. HY2025 lines written as YoY prior for an
 * HY2026 approve) are excluded so the Comparing menu never invents a fake pack.
 * Also requires the prior period to have statement lines when a prior exists,
 * so the YoY pair is backed by real data.
 */
export async function listAvailableReportPeriods(): Promise<AvailableReportPeriod[]> {
  const db = getDb();
  if (!db) return [];

  const fromMetrics = await db
    .selectDistinct({ periodId: metricValues.periodId })
    .from(metricValues);
  const primaryIds = new Set(fromMetrics.map((r) => r.periodId));
  if (primaryIds.size === 0) return [];

  const fromLines = await db
    .selectDistinct({ periodId: statementLines.periodId })
    .from(statementLines);
  const periodsWithLines = new Set(fromLines.map((r) => r.periodId));

  const rows = await db.select().from(fiscalPeriods);
  return rows
    .filter((p) => {
      if (!primaryIds.has(p.id)) return false;
      const prior = priorPeriodId(p.id);
      if (!prior) return true;
      return periodsWithLines.has(prior);
    })
    .sort((a, b) => b.sortOrder - a.sortOrder)
    .map((p) => ({
      id: p.id,
      label: p.label,
      basis: p.basis,
      periodType: p.periodType,
    }));
}

/**
 * Primary HY packs — used by Remove pack UI (same set as the report switcher, HY only).
 */
export async function listRemovableReportPeriods(): Promise<AvailableReportPeriod[]> {
  const all = await listAvailableReportPeriods();
  return all.filter((p) => p.periodType === "HY");
}

export async function getExtractionJobWithDraft(jobId: string) {
  const db = getDb();
  if (!db) return null;
  const [job] = await db.select().from(extractionJobs).where(eq(extractionJobs.id, jobId)).limit(1);
  if (!job) return null;
  const [draft] = await db
    .select()
    .from(extractionDrafts)
    .where(eq(extractionDrafts.jobId, job.id))
    .orderBy(desc(extractionDrafts.createdAt))
    .limit(1);
  return { job, draft: draft ?? null };
}

export async function getLatestExtractionJob(periodId?: string) {
  const db = getDb();
  if (!db) return null;
  const base = db.select().from(extractionJobs).orderBy(desc(extractionJobs.createdAt)).limit(1);
  const [job] = periodId
    ? await db
        .select()
        .from(extractionJobs)
        .where(eq(extractionJobs.periodId, periodId))
        .orderBy(desc(extractionJobs.createdAt))
        .limit(1)
    : await base;
  if (!job) return null;
  return getExtractionJobWithDraft(job.id);
}

/**
 * Admin: upload PDF → extract text → Claude structured extract → draft (not live facts).
 */
export async function runPdfExtraction(formData: FormData): Promise<IngestActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF file to upload." };
  }
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return { error: "File must be a PDF." };
  }

  const periodId = String(formData.get("periodId") || "hy2026");
  const available = periodsFrom(new Date()).filter((p) => p.periodType === "HY");
  if (!available.some((p) => p.id === periodId)) {
    return { error: `Period ${periodId} is not an available half-year period.` };
  }

  const comparativePeriodId = priorPeriodId(periodId);
  const sourceKind = "hy_interim";

  const db = getDb();
  if (!db) return { error: "Database is not configured." };

  const [job] = await db
    .insert(extractionJobs)
    .values({
      periodId,
      comparativePeriodId,
      sourceKind,
      status: "pending",
      sourceFilename: file.name,
      createdBy: admin.userId,
    })
    .returning();

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { text } = await pdfBufferToText(buffer);

    let storagePath: string | null = null;
    try {
      const supabase = createAdminSupabaseClient();
      const path = `hy-interims/${periodId}/${job.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("hy-interims")
        .upload(path, buffer, { contentType: "application/pdf", upsert: true });
      if (!uploadError) storagePath = path;
    } catch {
      // Storage optional — extract still proceeds with rawText on the job.
    }

    await db
      .update(extractionJobs)
      .set({ rawText: text, updatedAt: new Date() })
      .where(eq(extractionJobs.id, job.id));

    const { payload, model } = await extractStructuredFromText({
      text,
      periodId,
      comparativePeriodId,
      sourceKind,
    });

    const fullPayload = {
      ...payload,
      ...(storagePath ? { storagePath } : {}),
    };

    await db.insert(extractionDrafts).values({
      jobId: job.id,
      payload: fullPayload,
      model,
      promptVersion: PROMPT_VERSION,
    });

    await db
      .update(extractionJobs)
      .set({ status: "extracted", updatedAt: new Date(), error: null })
      .where(eq(extractionJobs.id, job.id));

    await db.insert(auditLog).values({
      actorUserId: admin.userId,
      action: "extraction.run",
      targetUserId: null,
      metadata: {
        jobId: job.id,
        periodId,
        filename: file.name,
        model,
        storagePath,
      },
    });

    return { success: "Extraction complete — review the draft below, then approve.", jobId: job.id };
  } catch (err) {
    let message = err instanceof Error ? err.message : "Extraction failed";
    // Anthropic SDK often stringifies the whole JSON body — surface the useful bit.
    const modelNotFound = message.match(/model:\s*([a-z0-9-]+)/i);
    if (message.includes("not_found_error") && modelNotFound) {
      message = `Claude model "${modelNotFound[1]}" is not available on this API key. Update AI_MODEL and retry.`;
    }
    await db
      .update(extractionJobs)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(extractionJobs.id, job.id));
    return { error: message };
  }
}

export async function approveExtractionJob(jobId: string): Promise<IngestActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const db = getDb();
  if (!db) return { error: "Database is not configured." };

  const [job] = await db.select().from(extractionJobs).where(eq(extractionJobs.id, jobId)).limit(1);
  if (!job) return { error: "Job not found." };
  if (job.status !== "extracted") {
    return { error: `Job status is ${job.status}; only extracted drafts can approve financials.` };
  }

  const [draft] = await db
    .select()
    .from(extractionDrafts)
    .where(eq(extractionDrafts.jobId, jobId))
    .orderBy(desc(extractionDrafts.createdAt))
    .limit(1);
  if (!draft) return { error: "No draft found for this job." };

  const parsed = extractionPayloadSchema.safeParse(draft.payload);
  if (!parsed.success) return { error: "Draft payload failed validation." };

  try {
    const chart = await loadChartOfAccounts();
    const payload = normalizeExtractionPayload(parsed.data, chart);
    await approveExtractionFinancials({
      jobId,
      payload,
    });
    await markInsightsStaleForPeriod(job.periodId);

    // Persist normalized codes back onto the draft so the UI shows chart ids
    await db
      .update(extractionDrafts)
      .set({ payload })
      .where(eq(extractionDrafts.id, draft.id));

    await db.insert(auditLog).values({
      actorUserId: admin.userId,
      action: "extraction.approve_financials",
      targetUserId: null,
      metadata: {
        jobId,
        periodId: job.periodId,
      },
    });

    revalidatePath("/admin/ingest");
    revalidatePath(`/reports/${job.periodId}`);

    return {
      success: "Financials approved. Metrics are live — review qualitative sections next.",
      jobId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Approve failed";
    return { error: message };
  }
}

/**
 * Admin: approve qualitative section bodies after financials are live.
 * Unlocks insights generation.
 */
export async function approveQualitativeJob(jobId: string): Promise<IngestActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const db = getDb();
  if (!db) return { error: "Database is not configured." };

  const [job] = await db.select().from(extractionJobs).where(eq(extractionJobs.id, jobId)).limit(1);
  if (!job) return { error: "Job not found." };
  if (job.status !== "financials_approved") {
    return {
      error: `Job status is ${job.status}; approve financials first, then qualitative sections.`,
    };
  }

  const [draft] = await db
    .select()
    .from(extractionDrafts)
    .where(eq(extractionDrafts.jobId, jobId))
    .orderBy(desc(extractionDrafts.createdAt))
    .limit(1);
  if (!draft) return { error: "No draft found for this job." };

  const parsed = extractionPayloadSchema.safeParse(draft.payload);
  if (!parsed.success) return { error: "Draft payload failed validation." };

  try {
    const chart = await loadChartOfAccounts();
    const payload = normalizeExtractionPayload(parsed.data, chart);
    await approveExtractionQualitative({
      jobId,
      payload,
    });
    await markInsightsStaleForPeriod(job.periodId);

    await db
      .update(extractionDrafts)
      .set({ payload })
      .where(eq(extractionDrafts.id, draft.id));

    await db.insert(auditLog).values({
      actorUserId: admin.userId,
      action: "extraction.approve_qualitative",
      targetUserId: null,
      metadata: {
        jobId,
        periodId: job.periodId,
      },
    });

    revalidatePath("/admin/ingest");
    revalidatePath(`/reports/${job.periodId}`);

    return {
      success: "Qualitative sections approved — generating commentary…",
      jobId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Approve qualitative failed";
    return { error: message };
  }
}

/**
 * Admin: persist edits to an extracted draft (statement lines / KPIs) before
 * approve. Does not write live facts.
 */
export async function updateExtractionDraft(
  jobId: string,
  payload: unknown,
): Promise<IngestActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const db = getDb();
  if (!db) return { error: "Database is not configured." };

  const [job] = await db.select().from(extractionJobs).where(eq(extractionJobs.id, jobId)).limit(1);
  if (!job) return { error: "Job not found." };
  if (job.status !== "extracted" && job.status !== "financials_approved") {
    return {
      error: `Job status is ${job.status}; only extracted or financials-approved drafts can be edited.`,
    };
  }

  const parsed = extractionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Draft failed validation." };
  }

  let normalized;
  try {
    const chart = await loadChartOfAccounts();
    normalized = normalizeExtractionPayload(parsed.data, chart);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to normalize draft lines." };
  }

  const codes = normalized.statementLines.map((l) => l.code);
  if (new Set(codes).size !== codes.length) {
    return { error: "Duplicate line item codes are not allowed." };
  }

  const [draft] = await db
    .select()
    .from(extractionDrafts)
    .where(eq(extractionDrafts.jobId, jobId))
    .orderBy(desc(extractionDrafts.createdAt))
    .limit(1);
  if (!draft) return { error: "No draft found for this job." };

  await db
    .update(extractionDrafts)
    .set({ payload: normalized })
    .where(eq(extractionDrafts.id, draft.id));

  await db.insert(auditLog).values({
    actorUserId: admin.userId,
    action: "extraction.draft_updated",
    targetUserId: null,
    metadata: {
      jobId,
      lineCount: normalized.statementLines.length,
      sectionCount: normalized.qualitativeSections.length,
    },
  });

  return { success: "Draft updates saved." };
}

export async function rejectExtractionJob(jobId: string): Promise<IngestActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const db = getDb();
  if (!db) return { error: "Database is not configured." };

  await db
    .update(extractionJobs)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(extractionJobs.id, jobId));

  await db.insert(auditLog).values({
    actorUserId: admin.userId,
    action: "extraction.reject",
    targetUserId: null,
    metadata: { jobId },
  });

  return { success: "Draft rejected. No live facts were changed." };
}

/**
 * Admin: remove all live facts for a primary period pack (and orphan prior
 * columns if that prior was never loaded as its own pack).
 */
export async function clearPeriodData(periodId: string): Promise<IngestActionResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const available = periodsFrom(new Date()).filter((p) => p.periodType === "HY");
  if (!available.some((p) => p.id === periodId)) {
    return { error: `Period ${periodId} is not a valid half-year period.` };
  }

  const db = getDb();
  if (!db) return { error: "Database is not configured." };

  try {
    const { clearedComparative } = await clearPeriodPack(periodId);
    await db.insert(auditLog).values({
      actorUserId: admin.userId,
      action: "extraction.clear_period",
      targetUserId: null,
      metadata: { periodId, clearedComparative },
    });
    revalidatePath("/admin/ingest");
    revalidatePath(`/reports/${periodId}`);
    if (clearedComparative) revalidatePath(`/reports/${clearedComparative}`);

    const priorNote = clearedComparative
      ? ` Comparative prior (${clearedComparative.toUpperCase()}) columns were also removed.`
      : "";
    return {
      success: `Removed pack for ${periodId.toUpperCase()}.${priorNote}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clear failed";
    return { error: message };
  }
}

