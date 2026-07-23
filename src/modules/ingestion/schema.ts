import { z } from "zod";

/**
 * Structured extraction payload — line items, operating KPIs, and verbatim
 * qualitative section bodies. Derived metrics (margins, runway, etc.) are
 * never produced by the LLM.
 */
export const statementLineSchema = z.object({
  code: z.string().min(1),
  current: z.number(),
  prior: z.number(),
});

export const operatingKpiSchema = z.object({
  periodId: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  basis: z.enum(["audited", "unaudited", "management"]),
  sourceRef: z.string().optional(),
});

/** Stable keys shown in admin UI; variable PDF headings map into the last two. */
export const QUALITATIVE_SECTION_KEYS = [
  "chairman_statement",
  "commercial_progress",
  "pipeline_outlook",
  "acquisitions",
  "strategic_outlook",
] as const;

export type QualitativeSectionKey = (typeof QUALITATIVE_SECTION_KEYS)[number];

export const QUALITATIVE_SECTION_LABELS: Record<QualitativeSectionKey, string> = {
  chairman_statement: "Chairman's Statement",
  commercial_progress: "Commercial Progress",
  pipeline_outlook: "Pipeline & Outlook",
  acquisitions: "Acquisitions",
  strategic_outlook: "Strategic Outlook",
};

export const qualitativeSectionSchema = z.object({
  key: z.enum(QUALITATIVE_SECTION_KEYS),
  /** Exact heading as it appeared in the PDF (especially for variable sections). */
  sourceHeading: z.string().default(""),
  /** Verbatim body under that heading until the next heading. */
  body: z.string().default(""),
});

export type QualitativeSection = z.infer<typeof qualitativeSectionSchema>;

export const extractionPayloadSchema = z.object({
  periodId: z.string().min(1),
  comparativePeriodId: z.string().min(1).nullable(),
  documentTitle: z.string().min(1),
  basis: z.enum(["audited", "unaudited", "management"]),
  statementLines: z.array(statementLineSchema).min(1),
  operatingKpis: z.array(operatingKpiSchema).default([]),
  qualitativeSections: z.array(qualitativeSectionSchema).default([]),
  /** Supabase Storage path for the source PDF (optional). */
  storagePath: z.string().optional(),
});

export type ExtractionPayload = z.infer<typeof extractionPayloadSchema>;

/** Ensure every stable key exists (empty body if the model omitted it). */
export function normalizeQualitativeSections(
  sections: QualitativeSection[] | undefined,
): QualitativeSection[] {
  const byKey = new Map((sections ?? []).map((s) => [s.key, s]));
  return QUALITATIVE_SECTION_KEYS.map((key) => {
    const existing = byKey.get(key);
    return {
      key,
      sourceHeading: existing?.sourceHeading ?? "",
      body: existing?.body ?? "",
    };
  });
}

export const PROMPT_VERSION = "v2";
