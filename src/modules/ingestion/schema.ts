import { z } from "zod";

/**
 * Structured extraction payload — line items and operating KPIs only.
 * Derived metrics (margins, runway, etc.) are never produced by the LLM.
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

export const extractionPayloadSchema = z.object({
  periodId: z.string().min(1),
  comparativePeriodId: z.string().min(1).nullable(),
  documentTitle: z.string().min(1),
  basis: z.enum(["audited", "unaudited", "management"]),
  statementLines: z.array(statementLineSchema).min(1),
  operatingKpis: z.array(operatingKpiSchema).default([]),
  /** Supabase Storage path for the source PDF (optional). */
  storagePath: z.string().optional(),
});

export type ExtractionPayload = z.infer<typeof extractionPayloadSchema>;

export const PROMPT_VERSION = "v1";
