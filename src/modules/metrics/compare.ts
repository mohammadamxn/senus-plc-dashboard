import { Decimal, d, margin, pctChange } from "@/lib/money";
import type { Meaningfulness, StatementAmounts } from "@/modules/metrics/engine";

export type ComparisonUnit = "EUR" | "percent" | "months" | "ratio" | "pp";

export type ComparisonMetric = {
  id: string;
  label: string;
  unit: ComparisonUnit;
  /** How to express the YoY change column */
  deltaUnit: ComparisonUnit;
  prior: number | null;
  current: number | null;
  delta: number | null;
  meaningfulness: Meaningfulness;
  /** When false, an increase is unfavourable (costs, burn, gearing, loss magnitude). */
  higherIsBetter: boolean;
};

function round(unit: ComparisonUnit, value: Decimal | null): number | null {
  if (value === null) return null;
  return value.toDecimalPlaces(unit === "EUR" ? 2 : 4).toNumber();
}

function absDelta(current: Decimal | null, prior: Decimal | null): Decimal | null {
  if (current === null || prior === null) return null;
  return current.minus(prior);
}

function row(
  id: string,
  label: string,
  unit: ComparisonUnit,
  deltaUnit: ComparisonUnit,
  prior: Decimal | null,
  current: Decimal | null,
  delta: Decimal | null,
  meaningfulness: Meaningfulness = "ok",
  higherIsBetter = true,
): ComparisonMetric {
  return {
    id,
    label,
    unit,
    deltaUnit,
    prior: round(unit, prior),
    current: round(unit, current),
    delta: round(deltaUnit, delta),
    meaningfulness,
    higherIsBetter,
  };
}

/**
 * Prior | current | YoY delta for every board KPI shown in section grids.
 * Growth % cards are folded into the delta column of level metrics.
 */
export function buildComparisonMetrics(lines: StatementAmounts): ComparisonMetric[] {
  const turnover = d(lines.turnover.current);
  const turnoverPrior = d(lines.turnover.prior);
  const gp = d(lines.gross_profit.current);
  const gpPrior = d(lines.gross_profit.prior);
  const admin = d(lines.administrative_expenses.current);
  const adminPrior = d(lines.administrative_expenses.prior);
  const opLoss = d(lines.operating_loss.current);
  const opLossPrior = d(lines.operating_loss.prior);
  const da = d(lines.cf_depreciation.current);
  const daPrior = d(lines.cf_depreciation.prior);
  const ebitda = opLoss.neg().plus(da);
  const ebitdaPrior = opLossPrior.neg().plus(daPrior);

  const gm = margin(gp, turnover);
  const gmPrior = margin(gpPrior, turnoverPrior);
  const opMargin = margin(opLoss.neg(), turnover);
  const opMarginPrior = margin(opLossPrior.neg(), turnoverPrior);
  const ebitdaMargin = margin(ebitda, turnover);
  const ebitdaMarginPrior = margin(ebitdaPrior, turnoverPrior);

  const cash = d(lines.cash.current);
  const cashPrior = d(lines.cash.prior);
  const monthsInPeriod = 6;
  const monthlyBurn = d(lines.cf_net_operating.current).abs().div(monthsInPeriod);
  const monthlyBurnPrior = d(lines.cf_net_operating.prior).abs().div(monthsInPeriod);
  const runway = monthlyBurn.isZero() ? null : cash.div(monthlyBurn);
  const runwayPrior = monthlyBurnPrior.isZero() ? null : cashPrior.div(monthlyBurnPrior);

  const bankDebt = d(lines.creditors_after_one_year.current).abs();
  const bankDebtPrior = d(lines.creditors_after_one_year.prior).abs();
  const netCash = cash.minus(bankDebt);
  const netCashPrior = cashPrior.minus(bankDebtPrior);

  const debtors = d(lines.debtors.current);
  const debtorsPrior = d(lines.debtors.prior);
  const creditors = d(lines.creditors_within_one_year.current).abs();
  const creditorsPrior = d(lines.creditors_within_one_year.prior).abs();
  const wc = debtors.minus(creditors);
  const wcPrior = debtorsPrior.minus(creditorsPrior);

  const currentAssets = d(lines.current_assets.current);
  const currentAssetsPrior = d(lines.current_assets.prior);
  const contingent = d(lines.contingent_consideration.current).abs();
  const contingentPrior = d(lines.contingent_consideration.prior).abs();
  const currentRatio = creditors.isZero() ? null : currentAssets.div(creditors);
  const currentRatioPrior = creditorsPrior.isZero() ? null : currentAssetsPrior.div(creditorsPrior);
  const currentRatioEarnout = creditors.plus(contingent).isZero()
    ? null
    : currentAssets.div(creditors.plus(contingent));
  const currentRatioEarnoutPrior = creditorsPrior.plus(contingentPrior).isZero()
    ? null
    : currentAssetsPrior.div(creditorsPrior.plus(contingentPrior));

  const equity = d(lines.equity.current);
  const equityPrior = d(lines.equity.prior);
  const gearing = equity.isZero() ? null : bankDebt.div(equity).times(100);
  const gearingPrior = equityPrior.isZero() ? null : bankDebtPrior.div(equityPrior).times(100);

  const interest = d(lines.interest_payable.current);
  const interestPrior = d(lines.interest_payable.prior);
  const dscr =
    ebitda.lte(0) || interest.isZero() ? null : ebitda.div(interest);
  const dscrPrior =
    ebitdaPrior.lte(0) || interestPrior.isZero() ? null : ebitdaPrior.div(interestPrior);
  const dscrMeaning: Meaningfulness =
    dscr === null || dscrPrior === null ? "degenerate" : "ok";
  const dscrDelta = dscr !== null && dscrPrior !== null ? absDelta(dscr, dscrPrior) : null;

  const capitalEmployed = d(lines.total_assets_less_current_liabilities.current);
  const capitalEmployedPrior = d(lines.total_assets_less_current_liabilities.prior);
  const roce = capitalEmployed.isZero() ? null : opLoss.neg().div(capitalEmployed).times(100);
  const rocePrior = capitalEmployedPrior.isZero()
    ? null
    : opLossPrior.neg().div(capitalEmployedPrior).times(100);
  const loss = d(lines.loss_for_period.current);
  const lossPrior = d(lines.loss_for_period.prior);
  const roe = equity.isZero() ? null : loss.neg().div(equity).times(100);
  const roePrior = equityPrior.isZero() ? null : lossPrior.neg().div(equityPrior).times(100);

  return [
    row("revenue", "Turnover", "EUR", "percent", turnoverPrior, turnover, pctChange(turnover, turnoverPrior)),
    row("gross_profit", "Gross profit", "EUR", "percent", gpPrior, gp, pctChange(gp, gpPrior)),
    row(
      "admin_expenses",
      "Administrative expenses",
      "EUR",
      "percent",
      adminPrior,
      admin,
      pctChange(admin, adminPrior),
      "ok",
      false,
    ),
    row(
      "gross_margin",
      "Gross margin",
      "percent",
      "pp",
      gmPrior,
      gm,
      gm && gmPrior ? gm.minus(gmPrior) : null,
      gm ? "ok" : "not_meaningful",
    ),
    row(
      "operating_margin",
      "Operating margin",
      "percent",
      "pp",
      opMarginPrior,
      opMargin,
      absDelta(opMargin, opMarginPrior),
      "not_meaningful",
    ),
    row(
      "ebitda_margin",
      "EBITDA margin",
      "percent",
      "pp",
      ebitdaMarginPrior,
      ebitdaMargin,
      absDelta(ebitdaMargin, ebitdaMarginPrior),
      "not_meaningful",
    ),
    row(
      "operating_loss",
      "Group operating loss",
      "EUR",
      "percent",
      opLossPrior,
      opLoss,
      pctChange(opLoss, opLossPrior),
      "ok",
      false,
    ),
    row("ebitda", "EBITDA (approx.)", "EUR", "percent", ebitdaPrior, ebitda, pctChange(ebitda, ebitdaPrior)),
    row("cash", "Cash & equivalents", "EUR", "percent", cashPrior, cash, pctChange(cash, cashPrior)),
    row(
      "monthly_burn",
      "Monthly operating cash burn",
      "EUR",
      "percent",
      monthlyBurnPrior,
      monthlyBurn,
      pctChange(monthlyBurn, monthlyBurnPrior),
      "ok",
      false,
    ),
    row(
      "cash_runway_months",
      "Cash runway",
      "months",
      "months",
      runwayPrior,
      runway,
      absDelta(runway, runwayPrior),
      runway === null ? "not_meaningful" : "ok",
    ),
    row("working_capital", "Working capital", "EUR", "percent", wcPrior, wc, pctChange(wc, wcPrior)),
    row("net_cash", "Net cash / (debt)", "EUR", "EUR", netCashPrior, netCash, absDelta(netCash, netCashPrior)),
    row(
      "current_ratio",
      "Current ratio",
      "ratio",
      "ratio",
      currentRatioPrior,
      currentRatio,
      absDelta(currentRatio, currentRatioPrior),
      currentRatio === null ? "not_meaningful" : "ok",
    ),
    row(
      "current_ratio_incl_earnout",
      "Current ratio (incl. contingent consideration)",
      "ratio",
      "ratio",
      currentRatioEarnoutPrior,
      currentRatioEarnout,
      absDelta(currentRatioEarnout, currentRatioEarnoutPrior),
      currentRatioEarnout === null ? "not_meaningful" : "ok",
    ),
    row(
      "gearing",
      "Gearing (bank debt / equity)",
      "percent",
      "pp",
      gearingPrior,
      gearing,
      absDelta(gearing, gearingPrior),
      gearing === null ? "not_meaningful" : "ok",
      false,
    ),
    row("equity", "Equity", "EUR", "EUR", equityPrior, equity, absDelta(equity, equityPrior)),
    row(
      "dscr",
      "DSCR (illustrative)",
      "ratio",
      "ratio",
      dscrPrior,
      dscr,
      dscrDelta,
      dscrMeaning,
    ),
    row("roce", "ROCE (half-year)", "percent", "pp", rocePrior, roce, absDelta(roce, rocePrior), "not_meaningful"),
    row(
      "roe",
      "Return on equity (half-year)",
      "percent",
      "pp",
      roePrior,
      roe,
      absDelta(roe, roePrior),
      "not_meaningful",
    ),
  ];
}
