import type { ExtractionPayload } from "@/modules/ingestion/schema";
import { normalizeQualitativeSections } from "@/modules/ingestion/schema";
import type { ChartRow } from "@/modules/ingestion/chart-types";

export type { ChartRow };

type ChartIndex = {
  codeSet: Set<string>;
  byCode: Map<string, ChartRow>;
  byLabel: Map<string, ChartRow[]>;
};

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildChartIndex(chart: ChartRow[]): ChartIndex {
  const codeSet = new Set(chart.map((c) => c.code));
  const byCode = new Map(chart.map((c) => [c.code, c]));
  const byLabel = new Map<string, ChartRow[]>();
  for (const row of chart) {
    const key = normalizeKey(row.label);
    const list = byLabel.get(key) ?? [];
    list.push(row);
    byLabel.set(key, list);
  }
  for (const list of byLabel.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return { codeSet, byCode, byLabel };
}

/**
 * Map a model-supplied code-or-label to a chart code.
 * Ambiguous labels (same display name on PL + CF) take the next unused
 * candidate in chart sort order — so the first "Interest payable…" →
 * interest_payable and the second → cf_interest_addback.
 */
function resolveChartCode(raw: string, used: Set<string>, index: ChartIndex): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (index.codeSet.has(trimmed) && !used.has(trimmed)) {
    return trimmed;
  }

  const labelMatches = index.byLabel.get(normalizeKey(trimmed));
  if (labelMatches && labelMatches.length > 0) {
    const unused = labelMatches.filter((r) => !used.has(r.code));
    if (unused.length > 0) return unused[0]!.code;
  }

  if (index.codeSet.has(trimmed)) return null;

  return null;
}

export type StatementLineIn = { code: string; current: number; prior: number };

/**
 * Coerce LLM statement lines onto unique chart-of-accounts codes.
 * Drops rows that cannot be mapped; keeps first mapping per code.
 */
export function normalizeStatementLines(
  lines: StatementLineIn[],
  chart: ChartRow[],
): StatementLineIn[] {
  const index = buildChartIndex(chart);
  const used = new Set<string>();
  const out: StatementLineIn[] = [];

  for (const line of lines) {
    const code = resolveChartCode(line.code, used, index);
    if (!code) continue;
    used.add(code);
    out.push({
      code,
      current: line.current,
      prior: line.prior,
    });
  }

  return out;
}

/** Normalize lines + qualitative sections on a full extraction payload. */
export function normalizeExtractionPayload(
  payload: ExtractionPayload,
  chart: ChartRow[],
): ExtractionPayload {
  const statementLines = normalizeStatementLines(payload.statementLines, chart);
  if (statementLines.length === 0) {
    throw new Error("No statement lines mapped to chart-of-accounts codes.");
  }
  return {
    ...payload,
    statementLines,
    qualitativeSections: normalizeQualitativeSections(payload.qualitativeSections),
  };
}

export function isChartCode(code: string, chart: ChartRow[]): boolean {
  return chart.some((c) => c.code === code);
}

export function chartRow(code: string, chart: ChartRow[]): ChartRow | undefined {
  return chart.find((c) => c.code === code);
}
