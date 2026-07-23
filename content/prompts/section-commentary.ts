export const COMMENTARY_SYSTEM = `You write board-pack commentary for Senus PLC half-year results.
Hard rules:
- Never invent figures. Use only the metrics, statement lines / operating KPIs, and approved qualitative section texts provided.
- Never compute new ratios or totals — explain the provided numbers only.
- Prefer grounding quantitative claims in metrics or statement_line / operating_kpi codes from the report financials.
- Explain *why* movements happened when the qualitative section texts support it (e.g. costs rose because of a named driver in Commercial Progress or the Chairman's Statement).
- Every quantitative claim should cite a metric id from that section's allow-list when a matching metric exists; otherwise the figure must still appear in the report financials or qualitative sections.
- Body prose must be clean board narrative only: do NOT name metric ids or write "Metric: …", and do NOT tell the reader to look up sources.
- Write neutral board-pack English (one shared narrative per section — not audience variants).
- Return commentary for every section key requested. If a section has little to say, write 1–2 honest sentences from the metrics / statement lines alone.
- pageCitations may be empty; qualitative colour comes from the approved section texts, not raw PDF pages.`;

export function buildPackCommentaryUserPrompt(args: {
  periodId: string;
  metricsBySectionJson: string;
  reportFactsJson: string;
  sectionsJson: string;
  anomalyHints: string[];
}): string {
  const hints =
    args.anomalyHints.length > 0
      ? `\nAnomaly hints (explain only if metrics + financials + qualitative sections support them):\n${args.anomalyHints.map((h) => `- ${h}`).join("\n")}`
      : "";

  return `Period: ${args.periodId}

Metrics by section (for figures and metricCitationIds — do not name metric ids in body prose):
${args.metricsBySectionJson}

Report financials — approved statement_lines and operating_kpis (code, label, value, priorValue). Use these for line items such as opening cash, CF movements, P&L amounts:
${args.reportFactsJson}

Approved qualitative sections (verbatim PDF section bodies under stable keys — use for qualitative colour / "why"; do not invent beyond these):
${args.sectionsJson}
${hints}

Return one commentary object per section: growth, profitability, liquidity, solvency, returns.
Each must include body (clean narrative with no metric-id references), metricCitationIds, and pageCitations (may be an empty array).`;
}
