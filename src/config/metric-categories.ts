import type { AudienceId } from "@/config/site";

/**
 * The five report sections named in the brief. Single source of truth for
 * "which metric ids live in which category" and "which audiences may see
 * that category at all" — both the report page (application-level hard
 * hiding) and the DB seed (metric_defs.audience_tags, for the RLS policy on
 * metric_values) read from this file so the two layers can't drift apart.
 */
export const CATEGORY_IDS = ["growth", "profitability", "liquidity", "solvency", "returns"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_METRIC_IDS: Record<CategoryId, string[]> = {
  growth: ["revenue", "gross_profit", "admin_expenses", "revenue_growth_yoy", "gross_profit_growth", "admin_growth"],
  profitability: [
    "gross_margin",
    "gross_margin_delta",
    "operating_margin",
    "ebitda_margin",
    "operating_loss",
    "ebitda",
  ],
  liquidity: ["cash", "monthly_burn", "cash_runway_months", "working_capital", "net_cash"],
  solvency: [
    "current_ratio",
    "current_ratio_incl_earnout",
    "gearing",
    "net_cash",
    "equity",
    "equity_build",
    "dscr",
  ],
  returns: ["roce", "roe", "ebitda_margin"],
};

/** Metrics shown as prior | current | YoY delta in each report section (no duplicate growth-only cards). */
export const REPORT_COMPARE_METRIC_IDS: Record<CategoryId, string[]> = {
  growth: ["revenue", "gross_profit", "admin_expenses"],
  profitability: ["gross_margin", "operating_margin", "ebitda_margin", "operating_loss", "ebitda"],
  liquidity: ["cash", "monthly_burn", "cash_runway_months", "working_capital", "net_cash"],
  solvency: ["current_ratio", "current_ratio_incl_earnout", "gearing", "net_cash", "equity", "dscr"],
  returns: ["roce", "roe", "ebitda_margin"],
};

/**
 * Access policy: Management and Board are internal audiences and keep full
 * visibility across all five categories — they run the company and carry
 * fiduciary duties across the whole picture. Equity and Credit are external
 * audiences and are hard-restricted to the categories they were granted:
 *   - Credit Providers: Solvency & Leverage, Cash & Liquidity, Profitability
 *   - Equity Investors: Growth & Revenue, Cash & Liquidity, Returns
 * Credit never sees Growth & Revenue or Returns; Equity never sees
 * Profitability or Solvency & Leverage. Both are granted Cash & Liquidity.
 */
export const CATEGORY_AUDIENCES: Record<CategoryId, AudienceId[]> = {
  growth: ["management", "board", "equity"],
  profitability: ["management", "board", "credit"],
  liquidity: ["management", "board", "credit", "equity"],
  solvency: ["management", "board", "credit"],
  returns: ["management", "board", "equity"],
};

export function visibleCategoriesFor(audience: AudienceId): Set<CategoryId> {
  return new Set(CATEGORY_IDS.filter((c) => CATEGORY_AUDIENCES[c].includes(audience)));
}

const ALL_CATEGORIZED_IDS = new Set(CATEGORY_IDS.flatMap((c) => CATEGORY_METRIC_IDS[c]));

/** Union of metric ids across every category visible to this audience. */
export function visibleMetricIdsFor(audience: AudienceId): Set<string> {
  const visible = visibleCategoriesFor(audience);
  const ids = new Set<string>();
  for (const c of CATEGORY_IDS) {
    if (visible.has(c)) for (const id of CATEGORY_METRIC_IDS[c]) ids.add(id);
  }
  return ids;
}

/**
 * True if this metric id may be shown to this audience: either it doesn't
 * belong to any of the five hard-restricted categories at all (so this
 * policy doesn't apply to it), or it belongs to one the audience is
 * granted.
 */
export function isMetricVisibleFor(audience: AudienceId, metricId: string): boolean {
  if (!ALL_CATEGORIZED_IDS.has(metricId)) return true;
  return visibleMetricIdsFor(audience).has(metricId);
}

/**
 * operating_kpis has no category structure of its own (it's a flat table of
 * ad-hoc commercial/liquidity highlights, not derived from the chart of
 * accounts) — most rows are generic commercial context visible to every
 * audience. Only these three (year-end cash position, fundraise targets)
 * carry the same sensitivity as the Cash & Liquidity category, so they're
 * tagged with that category's audiences for operating_kpis.audience_tags /
 * the RLS policy on that table; every other row is left untagged (NULL =
 * visible to everyone), same convention as metric_defs.
 */
export const LIQUIDITY_OPERATING_KPI_KEYS = new Set([
  "cash_year_end",
  "fundraise_target_min",
  "fundraise_target_max",
]);

/**
 * Per-metric audience tags for metric_defs — the union of every category
 * that metric belongs to (e.g. ebitda_margin appears in both Profitability
 * and Returns, so it keeps whichever audiences either category grants).
 * Metrics that belong to none of the five named categories (e.g. bank_debt,
 * nca_ex_earnout) are left untagged, i.e. visible to everyone, unchanged.
 */
export function buildMetricAudienceTags(): Record<string, AudienceId[]> {
  const tags: Record<string, Set<AudienceId>> = {};
  for (const c of CATEGORY_IDS) {
    for (const id of CATEGORY_METRIC_IDS[c]) {
      tags[id] ??= new Set<AudienceId>();
      for (const a of CATEGORY_AUDIENCES[c]) tags[id].add(a);
    }
  }
  return Object.fromEntries(Object.entries(tags).map(([id, set]) => [id, Array.from(set)]));
}
