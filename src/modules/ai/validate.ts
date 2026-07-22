import { z } from "zod";

export const COMMENTARY_PROMPT_VERSION = "v3";

export const commentaryOutputSchema = z.object({
  body: z.string().min(40).max(4000),
  /** Metric def ids or metric_value UUID strings the prose relies on */
  metricCitationIds: z.array(z.string()).default([]),
  /** Page + verbatim short quote the prose is grounded in */
  pageCitations: z
    .array(
      z.object({
        pageRef: z.string().min(1),
        quote: z.string().min(10).max(300),
      }),
    )
    .default([]),
});

export type CommentaryOutput = z.infer<typeof commentaryOutputSchema>;

export type MetricContextItem = {
  metricValueId: string;
  metricDefId: string;
  label: string;
  value: string | null;
  unit: string;
  priorValue?: string | null;
  deltaAbs?: string | null;
  deltaPct?: string | null;
};

export type PageContextItem = {
  pageRef: string;
  text: string;
};

/** Statement line or operating KPI amount from the approved pack (report financials). */
export type ReportFactItem = {
  code: string;
  label: string;
  value: string | null;
  priorValue?: string | null;
  unit?: string;
  source: "statement_line" | "operating_kpi";
};

export type ValidationResult =
  | { ok: true; output: CommentaryOutput }
  | { ok: false; errors: string[] };

/**
 * Temporarily passthrough — no citation / numeric gating.
 * Admin review is the quality gate; persist all Claude sections.
 */
export function validateCommentary(args: {
  output: CommentaryOutput;
  metrics: MetricContextItem[];
  pages: PageContextItem[];
  numberAllowMetrics?: MetricContextItem[];
  numberAllowFacts?: ReportFactItem[];
}): ValidationResult {
  void args.metrics;
  void args.pages;
  void args.numberAllowMetrics;
  void args.numberAllowFacts;
  return { ok: true, output: args.output };
}
