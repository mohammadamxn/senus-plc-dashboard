export const COMMENTARY_SYSTEM = `You write board-pack commentary for Senus PLC half-year results.
Hard rules:
- Never invent figures. Use only the metrics, statement lines / operating KPIs, and document page text provided.
- Never compute new ratios or totals — explain the provided numbers only.
- Prefer grounding quantitative claims in metrics or statement_line / operating_kpi codes from the report financials.
- Explain *why* movements happened when the PDF text supports it (e.g. costs rose because of X on p.N).
- Every quantitative claim should cite a metric id from that section's allow-list when a matching metric exists; otherwise the figure must still appear in the report financials or page text.
- When document pages are provided, cite at least one page per section that uses qualitative colour: give the exact pageRef and a short (10-300 char) verbatim quote copied from that page's text — never paraphrase the quote. Name the page in the prose too (e.g. "as noted on p.12").
- Write neutral board-pack English (one shared narrative per section — not audience variants).
- Return commentary for every section key requested. If a section has little to say, write 1–2 honest sentences from the metrics / statement lines alone.`;

export function buildPackCommentaryUserPrompt(args: {
  periodId: string;
  metricsBySectionJson: string;
  reportFactsJson: string;
  pagesJson: string;
  anomalyHints: string[];
}): string {
  const hints =
    args.anomalyHints.length > 0
      ? `\nAnomaly hints (explain only if metrics + financials + page text support them):\n${args.anomalyHints.map((h) => `- ${h}`).join("\n")}`
      : "";

  return `Period: ${args.periodId}

Metrics by section (cite metricValueId or metricDefId from the matching section):
${args.metricsBySectionJson}

Report financials — approved statement_lines and operating_kpis (code, label, value, priorValue). Use these for line items such as opening cash, CF movements, P&L amounts:
${args.reportFactsJson}

Document pages from the same HY results PDF (cite pageRef + a verbatim quote copied exactly from that page's text):
${args.pagesJson}
${hints}

Return one commentary object per section: growth, profitability, liquidity, solvency, returns.
Each must include body, metricCitationIds, and pageCitations (array of { pageRef, quote }).`;
}
