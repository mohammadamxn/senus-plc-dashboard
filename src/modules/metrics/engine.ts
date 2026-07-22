import { Decimal, d, margin, pctChange } from "@/lib/money";

export type Meaningfulness = "ok" | "not_meaningful" | "degenerate";

export type MetricResult = {
  id: string;
  label: string;
  value: number | null;
  unit: "EUR" | "percent" | "months" | "ratio" | "pp";
  meaningfulness: Meaningfulness;
  inputs: Record<string, number>;
};

export type StatementAmounts = Record<string, { current: number; prior: number }>;

function metric(
  id: string,
  label: string,
  unit: MetricResult["unit"],
  value: Decimal | null,
  meaningfulness: Meaningfulness,
  inputs: Record<string, number>,
): MetricResult {
  return {
    id,
    label,
    unit,
    value: value === null ? null : value.toDecimalPlaces(unit === "EUR" ? 2 : 4).toNumber(),
    meaningfulness,
    inputs,
  };
}

/** Absolute loss figures in the P&L are stored as positive "loss" amounts in seed where labels say Loss. */
export function computeMetrics(lines: StatementAmounts): MetricResult[] {
  const turnover = d(lines.turnover.current);
  const turnoverPrior = d(lines.turnover.prior);
  const gp = d(lines.gross_profit.current);
  const gpPrior = d(lines.gross_profit.prior);
  const admin = d(lines.administrative_expenses.current);
  const adminPrior = d(lines.administrative_expenses.prior);
  const opLoss = d(lines.operating_loss.current);
  const cash = d(lines.cash.current);
  const netOp = d(lines.cf_net_operating.current).abs();
  const monthsInPeriod = 6;
  const monthlyBurn = netOp.div(monthsInPeriod);
  const runway = monthlyBurn.isZero() ? null : cash.div(monthlyBurn);
  const bankDebt = d(lines.creditors_after_one_year.current).abs();
  const contingent = d(lines.contingent_consideration.current).abs();
  const nca = d(lines.net_current_assets.current);
  const ncaExEarnout = nca.plus(contingent);
  const da = d(lines.cf_depreciation.current);
  // Operating loss is positive in seed; EBITDA ≈ -(op loss) + D&A
  const ebitda = opLoss.neg().plus(da);
  const interest = d(lines.interest_payable.current);

  const revenueGrowth = pctChange(turnover, turnoverPrior);
  const gpGrowth = pctChange(gp, gpPrior);
  const gm = margin(gp, turnover);
  const gmPrior = margin(gpPrior, turnoverPrior);
  const gmDelta =
    gm && gmPrior ? gm.minus(gmPrior) : null;
  const adminGrowth = pctChange(admin, adminPrior);
  const opMargin = margin(opLoss.neg(), turnover);
  const ebitdaMargin = margin(ebitda, turnover);

  // Solvency / leverage / returns inputs
  const currentAssets = d(lines.current_assets.current);
  const creditorsWithin = d(lines.creditors_within_one_year.current).abs();
  const capitalEmployed = d(lines.total_assets_less_current_liabilities.current);
  const equity = d(lines.equity.current);
  const equityPrior = d(lines.equity.prior);
  const debtor = d(lines.debtors.current);
  const currentRatio = creditorsWithin.isZero() ? null : currentAssets.div(creditorsWithin);
  const currentRatioInclEarnout = creditorsWithin.plus(contingent).isZero()
    ? null
    : currentAssets.div(creditorsWithin.plus(contingent));
  const workingCapital = debtor.minus(creditorsWithin);
  const gearing = equity.isZero() ? null : bankDebt.div(equity).times(100);
  const roce = capitalEmployed.isZero() ? null : opLoss.neg().div(capitalEmployed).times(100);
  const roe = equity.isZero() ? null : d(lines.loss_for_period.current).neg().div(equity).times(100);

  const results: MetricResult[] = [
    metric("revenue", "Turnover", "EUR", turnover, "ok", {
      turnover: turnover.toNumber(),
    }),
    metric(
      "revenue_growth_yoy",
      "Revenue growth (YoY)",
      "percent",
      revenueGrowth,
      revenueGrowth === null ? "not_meaningful" : "ok",
      { current: turnover.toNumber(), prior: turnoverPrior.toNumber() },
    ),
    metric("gross_profit", "Gross profit", "EUR", gp, "ok", {
      gross_profit: gp.toNumber(),
    }),
    metric(
      "gross_profit_growth",
      "Gross profit growth",
      "percent",
      gpGrowth,
      gpGrowth === null ? "not_meaningful" : "ok",
      { current: gp.toNumber(), prior: gpPrior.toNumber() },
    ),
    metric("gross_margin", "Gross margin", "percent", gm, gm ? "ok" : "not_meaningful", {
      gross_profit: gp.toNumber(),
      turnover: turnover.toNumber(),
    }),
    metric(
      "gross_margin_delta",
      "Gross margin change",
      "pp",
      gmDelta,
      gmDelta ? "ok" : "not_meaningful",
      {},
    ),
    metric(
      "admin_growth",
      "Administrative expenses growth",
      "percent",
      adminGrowth,
      adminGrowth === null ? "not_meaningful" : "ok",
      { current: admin.toNumber(), prior: adminPrior.toNumber() },
    ),
    metric("operating_loss", "Group operating loss", "EUR", opLoss, "ok", {
      operating_loss: opLoss.toNumber(),
    }),
    metric(
      "operating_margin",
      "Operating margin",
      "percent",
      opMargin,
      "not_meaningful",
      { operating_loss: opLoss.toNumber(), turnover: turnover.toNumber() },
    ),
    metric("ebitda", "EBITDA (approx.)", "EUR", ebitda, "ok", {
      operating_loss: opLoss.toNumber(),
      depreciation: da.toNumber(),
    }),
    metric(
      "ebitda_margin",
      "EBITDA margin",
      "percent",
      ebitdaMargin,
      "not_meaningful",
      { ebitda: ebitda.toNumber(), turnover: turnover.toNumber() },
    ),
    metric("cash", "Cash & equivalents", "EUR", cash, "ok", {
      cash: cash.toNumber(),
    }),
    metric("monthly_burn", "Monthly operating cash burn", "EUR", monthlyBurn, "ok", {
      net_operating: lines.cf_net_operating.current,
      months: monthsInPeriod,
    }),
    metric(
      "cash_runway_months",
      "Cash runway",
      "months",
      runway,
      runway === null ? "not_meaningful" : "ok",
      { cash: cash.toNumber(), monthly_burn: monthlyBurn.toNumber() },
    ),
    metric("bank_debt", "Bank debt (creditors > 1 year)", "EUR", bankDebt, "ok", {
      creditors_after_one_year: bankDebt.toNumber(),
    }),
    metric(
      "net_cash",
      "Net cash / (debt)",
      "EUR",
      cash.minus(bankDebt),
      "ok",
      { cash: cash.toNumber(), bank_debt: bankDebt.toNumber() },
    ),
    metric(
      "nca_reported",
      "Net current assets (reported)",
      "EUR",
      nca,
      "ok",
      { net_current_assets: nca.toNumber() },
    ),
    metric(
      "nca_ex_earnout",
      "Net current assets ex contingent consideration",
      "EUR",
      ncaExEarnout,
      "ok",
      {
        net_current_assets: nca.toNumber(),
        contingent_consideration: contingent.toNumber(),
      },
    ),
    metric(
      "dscr",
      "DSCR (illustrative)",
      "ratio",
      ebitda.lte(0) || interest.isZero() ? null : ebitda.div(interest),
      ebitda.lte(0) || interest.isZero() ? "degenerate" : "ok",
      { ebitda: ebitda.toNumber(), interest: interest.toNumber() },
    ),
    metric(
      "working_capital",
      "Working capital (debtors − trade creditors)",
      "EUR",
      workingCapital,
      "ok",
      { debtors: debtor.toNumber(), creditors_within_one_year: creditorsWithin.toNumber() },
    ),
    metric(
      "current_ratio",
      "Current ratio",
      "ratio",
      currentRatio,
      currentRatio === null ? "not_meaningful" : "ok",
      { current_assets: currentAssets.toNumber(), creditors_within_one_year: creditorsWithin.toNumber() },
    ),
    metric(
      "current_ratio_incl_earnout",
      "Current ratio (incl. contingent consideration)",
      "ratio",
      currentRatioInclEarnout,
      currentRatioInclEarnout === null ? "not_meaningful" : "ok",
      {
        current_assets: currentAssets.toNumber(),
        creditors_within_one_year: creditorsWithin.toNumber(),
        contingent_consideration: contingent.toNumber(),
      },
    ),
    metric(
      "gearing",
      "Gearing (bank debt / equity)",
      "percent",
      gearing,
      gearing === null ? "not_meaningful" : "ok",
      { bank_debt: bankDebt.toNumber(), equity: equity.toNumber() },
    ),
    metric(
      "equity_build",
      "Equity movement vs prior half",
      "EUR",
      equity.minus(equityPrior),
      "ok",
      { equity: equity.toNumber(), equity_prior: equityPrior.toNumber() },
    ),
    metric(
      "roce",
      "ROCE (half-year)",
      "percent",
      roce,
      "not_meaningful",
      { operating_loss: opLoss.toNumber(), capital_employed: capitalEmployed.toNumber() },
    ),
    metric(
      "roe",
      "Return on equity (half-year)",
      "percent",
      roe,
      "not_meaningful",
      { loss_for_period: lines.loss_for_period.current, equity: equity.toNumber() },
    ),
  ];

  return results;
}

export type CostComponent = { id: string; label: string; amount: number; prior?: number };

/** Cost structure for the period — cost of sales, admin, distribution, depreciation. */
export function costBreakdown(lines: StatementAmounts): CostComponent[] {
  const components = [
    {
      id: "cost_of_sales",
      label: "Cost of sales",
      amount: d(lines.cost_of_sales.current).toNumber(),
      prior: d(lines.cost_of_sales.prior).toNumber(),
    },
    {
      id: "administrative_expenses",
      label: "Administrative expenses",
      amount: d(lines.administrative_expenses.current).toNumber(),
      prior: d(lines.administrative_expenses.prior).toNumber(),
    },
    {
      id: "distribution_costs",
      label: "Distribution costs",
      amount: d(lines.distribution_costs.current).toNumber(),
      prior: d(lines.distribution_costs.prior).toNumber(),
    },
    {
      id: "cf_depreciation",
      label: "Depreciation",
      amount: d(lines.cf_depreciation.current).toNumber(),
      prior: d(lines.cf_depreciation.prior).toNumber(),
    },
  ].filter((c) => c.amount > 0 || c.prior > 0);

  const totalCurrent = components.reduce((s, c) => s + c.amount, 0);
  const totalPrior = components.reduce((s, c) => s + (c.prior ?? 0), 0);
  if (totalCurrent > 0 || totalPrior > 0) {
    components.push({
      id: "total",
      label: "Total costs",
      amount: totalCurrent,
      prior: totalPrior,
    });
  }
  return components;
}

export type CashWalkStep = { id: string; label: string; amount: number; kind: "start" | "flow" | "end" };

/** Opening → operating → investing → financing → closing cash movement (waterfall). */
export function cashWalk(lines: StatementAmounts): CashWalkStep[] {
  return [
    { id: "opening", label: "Opening cash", amount: d(lines.cf_opening_cash.current).toNumber(), kind: "start" },
    { id: "operating", label: "Operating activities", amount: d(lines.cf_net_operating.current).toNumber(), kind: "flow" },
    { id: "investing", label: "Investing activities", amount: d(lines.cf_net_investing.current).toNumber(), kind: "flow" },
    { id: "financing", label: "Financing activities", amount: d(lines.cf_net_financing.current).toNumber(), kind: "flow" },
    { id: "closing", label: "Closing cash", amount: d(lines.cf_closing_cash.current).toNumber(), kind: "end" },
  ];
}

export type BridgeStepKind = "line" | "subtotal" | "total";

export type BridgeStep = {
  id: string;
  label: string;
  amount: number;
  kind: BridgeStepKind;
};

/** EBITDA → operating cash → FCF-style bridge from published CF lines. */
export function ebitdaToFcfBridge(lines: StatementAmounts): BridgeStep[] {
  const opLoss = d(lines.operating_loss.current);
  const da = d(lines.cf_depreciation.current);
  const ebitda = opLoss.neg().plus(da);
  const wc = d(lines.cf_wc_movement.current);
  const interestPaid = d(lines.cf_interest_paid.current);
  const capex = d(lines.cf_capex.current);
  const netOp = d(lines.cf_net_operating.current);

  return [
    { id: "ebitda", label: "EBITDA (approx.)", amount: ebitda.toNumber(), kind: "line" },
    { id: "wc", label: "Working capital movement", amount: wc.toNumber(), kind: "line" },
    {
      id: "other_ops",
      label: "Other operating adjustments",
      amount: netOp.minus(ebitda).minus(wc).minus(interestPaid).toNumber(),
      kind: "line",
    },
    { id: "interest", label: "Interest paid", amount: interestPaid.toNumber(), kind: "line" },
    { id: "net_op", label: "Net operating cash flow", amount: netOp.toNumber(), kind: "subtotal" },
    {
      id: "capex",
      label: "Capex (fixed / intangible asset acquisitions)",
      amount: capex.toNumber(),
      kind: "line",
    },
    {
      id: "fcf",
      label: "Free cash flow (FCF) proxy",
      amount: netOp.plus(capex).toNumber(),
      kind: "total",
    },
  ];
}

export type IntegrityIssue = { code: string; message: string };

export function validateStatementIntegrity(lines: StatementAmounts): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const fa =
    d(lines.goodwill.current)
      .plus(lines.development_costs.current)
      .plus(lines.tangible_assets.current);
  if (!fa.equals(lines.fixed_assets.current)) {
    issues.push({
      code: "fixed_assets_sum",
      message: `Fixed assets ${lines.fixed_assets.current} ≠ sum of components ${fa.toNumber()}`,
    });
  }
  const ca = d(lines.debtors.current).plus(lines.cash.current);
  // Published totals can round by €1 vs component sum
  if (ca.minus(lines.current_assets.current).abs().gt(1)) {
    issues.push({
      code: "current_assets_sum",
      message: `Current assets mismatch`,
    });
  }
  if (!d(lines.cash.current).equals(lines.cf_closing_cash.current)) {
    issues.push({
      code: "cash_tie",
      message: `BS cash ${lines.cash.current} ≠ CF closing cash ${lines.cf_closing_cash.current}`,
    });
  }
  if (!d(lines.net_assets.current).equals(lines.equity.current)) {
    issues.push({
      code: "equity_tie",
      message: `Net assets ≠ equity`,
    });
  }
  return issues;
}
