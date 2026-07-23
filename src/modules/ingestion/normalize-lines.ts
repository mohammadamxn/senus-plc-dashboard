import { readFileSync } from "fs";
import path from "path";
import type { ExtractionPayload } from "@/modules/ingestion/schema";
import { normalizeQualitativeSections } from "@/modules/ingestion/schema";

type ChartRow = {
  code: string;
  label: string;
  statement: string;
  sortOrder: number;
};

const CHART = JSON.parse(
  readFileSync(path.join(process.cwd(), "content", "seed", "chart-of-accounts.json"), "utf8"),
) as ChartRow[];

const CODE_SET = new Set(CHART.map((c) => c.code));
const BY_CODE = new Map(CHART.map((c) => [c.code, c]));

/** Lowercased label → chart rows sharing that label (sorted by sortOrder). */
const BY_LABEL = new Map<string, ChartRow[]>();
for (const row of CHART) {
  const key = normalizeKey(row.label);
  const list = BY_LABEL.get(key) ?? [];
  list.push(row);
  BY_LABEL.set(key, list);
}
for (const list of BY_LABEL.values()) {
  list.sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Map a model-supplied code-or-label to a chart code.
 * Ambiguous labels (same display name on PL + CF) take the next unused
 * candidate in chart sort order — so the first "Interest payable…" →
 * interest_payable and the second → cf_interest_addback.
 */
function resolveChartCode(raw: string, used: Set<string>): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (CODE_SET.has(trimmed) && !used.has(trimmed)) {
    return trimmed;
  }

  const labelMatches = BY_LABEL.get(normalizeKey(trimmed));
  if (labelMatches && labelMatches.length > 0) {
    const unused = labelMatches.filter((r) => !used.has(r.code));
    if (unused.length > 0) return unused[0]!.code;
    // All candidates already used — fall through
  }

  // Already-valid code that was duplicated: skip (caller drops)
  if (CODE_SET.has(trimmed)) return null;

  return null;
}

export type StatementLineIn = { code: string; current: number; prior: number };

/**
 * Coerce LLM statement lines onto unique chart-of-accounts codes.
 * Drops rows that cannot be mapped; keeps first mapping per code.
 */
export function normalizeStatementLines(lines: StatementLineIn[]): StatementLineIn[] {
  const used = new Set<string>();
  const out: StatementLineIn[] = [];

  for (const line of lines) {
    const code = resolveChartCode(line.code, used);
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
export function normalizeExtractionPayload(payload: ExtractionPayload): ExtractionPayload {
  const statementLines = normalizeStatementLines(payload.statementLines);
  if (statementLines.length === 0) {
    throw new Error("No statement lines mapped to chart-of-accounts codes.");
  }
  return {
    ...payload,
    statementLines,
    qualitativeSections: normalizeQualitativeSections(payload.qualitativeSections),
  };
}

export function isChartCode(code: string): boolean {
  return CODE_SET.has(code);
}

export function chartRow(code: string): ChartRow | undefined {
  return BY_CODE.get(code);
}
