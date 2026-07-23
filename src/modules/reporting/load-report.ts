import { readFileSync } from "fs";
import path from "path";
import { inArray } from "drizzle-orm";
import {
  computeMetrics,
  ebitdaToFcfBridge,
  validateStatementIntegrity,
  costBreakdown,
  cashWalk,
  type MetricResult,
  type BridgeStep,
  type StatementAmounts,
  type CostComponent,
  type CashWalkStep,
} from "@/modules/metrics/engine";
import { buildComparisonMetrics, type ComparisonMetric } from "@/modules/metrics/compare";
import type { Db } from "@/db/client";
import { companies, fiscalPeriods, lineItemDefs, statementLines, operatingKpis } from "@/db/schema";
import { withAudienceScope } from "@/modules/auth/db-scope";
import { loadChartOfAccounts } from "@/modules/ingestion/chart";
import type { AudienceId } from "@/config/site";

function seedPath(...parts: string[]) {
  return path.join(process.cwd(), "content", "seed", ...parts);
}

function readJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(seedPath(...parts), "utf8")) as T;
}

export type PeriodMeta = {
  id: string;
  label: string;
  basis: string;
  periodType: string;
  startDate: string;
  endDate: string;
  notes?: string;
};

export type OperatingKpi = {
  periodId: string;
  key: string;
  label: string;
  value: number;
  unit: string;
  basis: string;
  sourceRef?: string;
};

export type StatementRow = {
  code: string;
  label: string;
  current: number;
  prior: number;
  isSubtotal?: boolean;
};

export type ReportBundle = {
  company: { legalName: string };
  period: PeriodMeta;
  comparativeLabel: string | null;
  metrics: MetricResult[];
  comparisonMetrics: ComparisonMetric[];
  bridge: BridgeStep[];
  costBreakdown: CostComponent[];
  cashWalk: CashWalkStep[];
  revenueSeries: { label: string; turnover: number; grossProfit: number }[];
  cashSeries: { label: string; cash: number; netCash: number }[];
  balanceSheetComposition: { id: string; label: string; amount: number }[];
  integrityIssues: { code: string; message: string }[];
  plRows: StatementRow[];
  bsRows: StatementRow[];
  cfRows: StatementRow[];
  operatingKpis: OperatingKpi[];
  liquidityThenVsNow: {
    hyCash: number;
    fyeCash: number | null;
    fundraiseMin: number | null;
    fundraiseMax: number | null;
  };
};

const PL_CODES = [
  "turnover",
  "cost_of_sales",
  "gross_profit",
  "distribution_costs",
  "administrative_expenses",
  "other_operating_income",
  "operating_loss",
  "other_gains_losses",
  "interest_payable",
  "loss_before_tax",
  "tax_expense",
  "loss_for_period",
] as const;

const BS_CODES = [
  "goodwill",
  "development_costs",
  "tangible_assets",
  "fixed_assets",
  "debtors",
  "cash",
  "current_assets",
  "creditors_within_one_year",
  "contingent_consideration",
  "net_current_assets",
  "total_assets_less_current_liabilities",
  "creditors_after_one_year",
  "net_assets",
  "share_capital",
  "share_premium",
  "retained_earnings",
  "equity",
] as const;

const CF_CODES = [
  "cf_loss",
  "cf_interest_addback",
  "cf_depreciation",
  "cf_wc_movement",
  "cf_cash_used_in_operations",
  "cf_interest_paid",
  "cf_net_operating",
  "cf_capex",
  "cf_net_investing",
  "cf_loans",
  "cf_share_issue",
  "cf_net_financing",
  "cf_net_change",
  "cf_opening_cash",
  "cf_closing_cash",
] as const;

const BS_COMPOSITION_CODES = ["goodwill", "development_costs", "tangible_assets", "debtors", "cash"] as const;

function buildRows(
  codes: readonly string[],
  lines: StatementAmounts,
  labelByCode: Record<string, { label: string; isSubtotal?: boolean }>,
): StatementRow[] {
  return codes
    .filter((code) => lines[code])
    .map((code) => ({
      code,
      label: labelByCode[code]?.label ?? code,
      current: lines[code].current,
      prior: lines[code].prior,
      isSubtotal: labelByCode[code]?.isSubtotal,
    }));
}

function buildChartData(lines: StatementAmounts, currentLabel: string, priorLabel: string) {
  const bankDebtCurrent = Math.abs(Number(lines.creditors_after_one_year?.current ?? 0));
  const bankDebtPrior = Math.abs(Number(lines.creditors_after_one_year?.prior ?? 0));
  return {
    costBreakdown: costBreakdown(lines),
    cashWalk: cashWalk(lines),
    revenueSeries: [
      { label: priorLabel, turnover: lines.turnover.prior, grossProfit: lines.gross_profit.prior },
      { label: currentLabel, turnover: lines.turnover.current, grossProfit: lines.gross_profit.current },
    ],
    cashSeries: [
      {
        label: priorLabel,
        cash: lines.cash.prior,
        netCash: lines.cash.prior - bankDebtPrior,
      },
      {
        label: currentLabel,
        cash: lines.cash.current,
        netCash: lines.cash.current - bankDebtCurrent,
      },
    ],
    balanceSheetComposition: BS_COMPOSITION_CODES.filter((c) => lines[c] && lines[c].current > 0).map(
      (c): { id: string; label: string; amount: number } => ({
        id: c,
        label: c,
        amount: lines[c].current,
      }),
    ),
  };
}

export async function loadReportFromSeed(periodId = "hy2026"): Promise<ReportBundle> {
  const company = readJson<{ legalName: string }>("company.json");
  const periods = readJson<PeriodMeta[]>("periods.json");
  const chart = await loadChartOfAccounts();
  const kpis = readJson<OperatingKpi[]>("operating-kpis.json");
  const statement = readJson<{
    periodId: string;
    comparativePeriodId: string;
    lines: StatementAmounts;
  }>("statements", "hy2026.json");

  const period = periods.find((p) => p.id === periodId) ?? periods.find((p) => p.id === "hy2026")!;
  const comparative = periods.find((p) => p.id === statement.comparativePeriodId);

  const labelByCode = Object.fromEntries(chart.map((c) => [c.code, c]));
  const plRows = buildRows(PL_CODES, statement.lines, labelByCode);
  const bsRows = buildRows(BS_CODES, statement.lines, labelByCode);
  const cfRows = buildRows(CF_CODES, statement.lines, labelByCode);

  const currentLabel = period.label;
  const priorLabel = comparative?.label ?? "Prior";
  const charts = buildChartData(statement.lines, currentLabel, priorLabel);
  charts.balanceSheetComposition = charts.balanceSheetComposition.map((c) => ({
    ...c,
    label: labelByCode[c.id]?.label ?? c.id,
  }));

  const fyeCash = kpis.find((k) => k.periodId === "fy2026" && k.key === "cash_year_end")?.value ?? null;
  const fundraiseMin =
    kpis.find((k) => k.periodId === "fy2026" && k.key === "fundraise_target_min")?.value ?? null;
  const fundraiseMax =
    kpis.find((k) => k.periodId === "fy2026" && k.key === "fundraise_target_max")?.value ?? null;

  return {
    company,
    period,
    comparativeLabel: comparative?.label ?? null,
    metrics: computeMetrics(statement.lines),
    comparisonMetrics: buildComparisonMetrics(statement.lines),
    bridge: ebitdaToFcfBridge(statement.lines),
    ...charts,
    integrityIssues: validateStatementIntegrity(statement.lines),
    plRows,
    bsRows,
    cfRows,
    operatingKpis: kpis.filter((k) => k.periodId === periodId || k.periodId === "fy2026"),
    liquidityThenVsNow: {
      hyCash: statement.lines.cash.current,
      fyeCash,
      fundraiseMin,
      fundraiseMax,
    },
  };
}

/**
 * Same shape as loadReportFromSeed, but sourced from Supabase Postgres.
 * Only HY2026 (and its HY2025 comparative) currently has statement_lines rows —
 * the fy2026 route reuses the HY2026 statutory statement, same as the seed path,
 * and layers FY2026 narrative operating_kpis on top.
 */
async function loadReportFromDb(db: Db, periodId: string): Promise<ReportBundle> {
  const statementPeriodId = periodId === "fy2026" ? "hy2026" : periodId;

  const [company] = await db.select().from(companies).limit(1);
  const periods = await db.select().from(fiscalPeriods);
  if (!company || periods.length === 0) {
    throw new Error("Database has no seeded company/fiscal_periods rows");
  }

  const period = periods.find((p) => p.id === periodId) ?? periods.find((p) => p.id === "hy2026")!;
  const statementPeriod =
    periods.find((p) => p.id === statementPeriodId) ?? periods.find((p) => p.id === "hy2026")!;

  const comparative = periods
    .filter((p) => p.periodType === statementPeriod.periodType && p.startDate < statementPeriod.startDate)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0];

  const chart = await db.select().from(lineItemDefs);
  const labelByCode = Object.fromEntries(chart.map((c) => [c.code, c]));

  const relevantPeriodIds = comparative ? [statementPeriod.id, comparative.id] : [statementPeriod.id];
  const rows = await db
    .select({ periodId: statementLines.periodId, code: statementLines.lineItemCode, amount: statementLines.amount })
    .from(statementLines)
    .where(inArray(statementLines.periodId, relevantPeriodIds));

  const lines: StatementAmounts = {};
  for (const c of chart) {
    const current = rows.find((r) => r.periodId === statementPeriod.id && r.code === c.code);
    const prior = comparative ? rows.find((r) => r.periodId === comparative.id && r.code === c.code) : undefined;
    lines[c.code] = {
      current: current ? Number(current.amount) : 0,
      prior: prior ? Number(prior.amount) : 0,
    };
  }

  const plRows = buildRows(PL_CODES, lines, labelByCode);
  const bsRows = buildRows(BS_CODES, lines, labelByCode);
  const cfRows = buildRows(CF_CODES, lines, labelByCode);

  const currentLabel = period.label;
  const priorLabel = comparative?.label ?? "Prior";
  const charts = buildChartData(lines, currentLabel, priorLabel);
  charts.balanceSheetComposition = charts.balanceSheetComposition.map((c) => ({
    ...c,
    label: labelByCode[c.id]?.label ?? c.id,
  }));

  // Always load FY2026 liquidity KPIs for the then-vs-now panel when viewing HY;
  // the report page filters commercial KPIs so FY chairman figures do not appear
  // under Growth on the HY pack.
  const kpis = await db
    .select()
    .from(operatingKpis)
    .where(
      inArray(
        operatingKpis.periodId,
        periodId === "fy2026" ? ["fy2026"] : [periodId, "fy2026"],
      ),
    );

  const kpiRows: OperatingKpi[] = kpis.map((k) => ({
    periodId: k.periodId,
    key: k.key,
    label: k.label,
    value: Number(k.value),
    unit: k.unit,
    basis: k.basis,
    sourceRef: k.sourceRef ?? undefined,
  }));

  const fyeCash = kpiRows.find((k) => k.periodId === "fy2026" && k.key === "cash_year_end")?.value ?? null;
  const fundraiseMin =
    kpiRows.find((k) => k.periodId === "fy2026" && k.key === "fundraise_target_min")?.value ?? null;
  const fundraiseMax =
    kpiRows.find((k) => k.periodId === "fy2026" && k.key === "fundraise_target_max")?.value ?? null;

  return {
    company: { legalName: company.legalName },
    period: {
      id: period.id,
      label: period.label,
      basis: period.basis,
      periodType: period.periodType,
      startDate: period.startDate,
      endDate: period.endDate,
      notes: period.notes ?? undefined,
    },
    comparativeLabel: comparative?.label ?? null,
    metrics: computeMetrics(lines),
    comparisonMetrics: buildComparisonMetrics(lines),
    bridge: ebitdaToFcfBridge(lines),
    ...charts,
    integrityIssues: validateStatementIntegrity(lines),
    plRows,
    bsRows,
    cfRows,
    operatingKpis: kpiRows,
    liquidityThenVsNow: {
      hyCash: lines.cash?.current ?? 0,
      fyeCash,
      fundraiseMin,
      fundraiseMax,
    },
  };
}

/**
 * Reads from Supabase through the least-privilege app_runtime connection,
 * scoped to the signed-in user's audience for the duration of one
 * transaction (see withAudienceScope). Falls back to seed JSON only when
 * RUNTIME_DATABASE_URL is unset (local demos without DB). When the runtime
 * DB is configured, empty statement_lines means an empty pack — never
 * silently refill from seed (that would break upload-from-empty testing).
 */
export async function loadReport(periodId = "hy2026", audience: AudienceId): Promise<ReportBundle> {
  if (process.env.RUNTIME_DATABASE_URL) {
    return await withAudienceScope(audience, (tx) => loadReportFromDb(tx, periodId));
  }
  return await loadReportFromSeed(periodId);
}
