export const COMMENTARY_SYSTEM = `You write board-pack commentary for Senus PLC half-year results.
Hard rules:
- Never invent figures. Use only the metrics, statement lines / operating KPIs, and document page text provided.
- Never compute new ratios or totals — explain the provided numbers only.
- Prefer grounding quantitative claims in metrics or statement_line / operating_kpi codes from the report financials.
- Explain *why* movements happened when the PDF text supports it (e.g. costs rose because of a named driver in the narrative).
- Every quantitative claim should cite a metric id from that section's allow-list when a matching metric exists; otherwise the figure must still appear in the report financials or page text.
- When document pages are provided, include at least one pageCitation per section that uses qualitative colour: give the exact pageRef and a short verbatim quote copied from that page's text — never paraphrase the quote.
- HARD LIMIT: each pageCitations[].quote must be between 10 and 300 characters inclusive. If the useful passage is longer, copy a shorter contiguous excerpt (one or two sentences max). Never exceed 300 characters — longer quotes reject the entire response.
- Body prose must be clean board narrative only: do NOT mention page numbers (no "p.12", "page 12", "as noted on p.N"), do NOT name metric ids or write "Metric: …", and do NOT tell the reader to look up sources — page grounding belongs only in pageCitations.
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

Metrics by section (for figures and metricCitationIds — do not name metric ids in body prose):
${args.metricsBySectionJson}

Report financials — approved statement_lines and operating_kpis (code, label, value, priorValue). Use these for line items such as opening cash, CF movements, P&L amounts:
${args.reportFactsJson}

Document pages from the same HY results PDF (use for pageCitations only — do not mention page numbers in body):
${args.pagesJson}
${hints}

Return one commentary object per section: growth, profitability, liquidity, solvency, returns.
Each must include body (clean narrative with no page or metric-id references), metricCitationIds, and pageCitations (array of { pageRef, quote }).
For every quote: 10–300 characters only. Prefer ≤200. If a PDF sentence is longer, excerpt — do not return quotes over 300 characters.`;
}
