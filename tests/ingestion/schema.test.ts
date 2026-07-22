import { describe, expect, it } from "vitest";
import { extractionPayloadSchema } from "@/modules/ingestion/schema";
import { computeMetrics } from "@/modules/metrics/engine";

describe("extractionPayloadSchema", () => {
  it("accepts a minimal valid payload", () => {
    const parsed = extractionPayloadSchema.safeParse({
      periodId: "hy2026",
      comparativePeriodId: "hy2025",
      documentTitle: "HY2026",
      basis: "unaudited",
      statementLines: [{ code: "turnover", current: 354813, prior: 340931 }],
      operatingKpis: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing statement lines", () => {
    const parsed = extractionPayloadSchema.safeParse({
      periodId: "hy2026",
      comparativePeriodId: "hy2025",
      documentTitle: "HY2026",
      basis: "unaudited",
      statementLines: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-numeric amounts", () => {
    const parsed = extractionPayloadSchema.safeParse({
      periodId: "hy2026",
      comparativePeriodId: null,
      documentTitle: "HY2026",
      basis: "unaudited",
      statementLines: [{ code: "turnover", current: "354813", prior: 0 }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("metrics after extraction (deterministic)", () => {
  it("calculates gross margin from statement lines, not from the LLM", () => {
    const metrics = computeMetrics({
      turnover: { current: 354813, prior: 340931 },
      cost_of_sales: { current: 64861, prior: 69600 },
      gross_profit: { current: 289952, prior: 272331 },
      distribution_costs: { current: 0, prior: 0 },
      administrative_expenses: { current: 781975, prior: 677908 },
      other_operating_income: { current: 8269, prior: 0 },
      operating_loss: { current: 483753, prior: 405577 },
      other_gains_losses: { current: 0, prior: 0 },
      interest_payable: { current: 1391, prior: 1036 },
      loss_before_tax: { current: 485144, prior: 406613 },
      tax_expense: { current: 0, prior: 0 },
      loss_for_period: { current: 485144, prior: 406613 },
      goodwill: { current: 669550, prior: 0 },
      development_costs: { current: 239765, prior: 0 },
      tangible_assets: { current: 42006, prior: 65363 },
      fixed_assets: { current: 951321, prior: 65363 },
      debtors: { current: 188149, prior: 211150 },
      cash: { current: 735189, prior: 72382 },
      current_assets: { current: 923339, prior: 283533 },
      creditors_within_one_year: { current: 387105, prior: 90111 },
      contingent_consideration: { current: 850000, prior: 0 },
      net_current_assets: { current: -313766, prior: 193421 },
      total_assets_less_current_liabilities: { current: 637554, prior: 258784 },
      creditors_after_one_year: { current: 76474, prior: 85468 },
      net_assets: { current: 561081, prior: 173316 },
      share_capital: { current: 25000, prior: 144 },
      share_premium: { current: 300000, prior: 849963 },
      retained_earnings: { current: 236081, prior: -676790 },
      equity: { current: 561081, prior: 173316 },
      cf_loss: { current: -485144, prior: -406613 },
      cf_interest_addback: { current: 1391, prior: 1036 },
      cf_depreciation: { current: 10014, prior: 10016 },
      cf_wc_movement: { current: 64839, prior: -53584 },
      cf_cash_used_in_operations: { current: -408900, prior: -449145 },
      cf_interest_paid: { current: -1391, prior: -1036 },
      cf_net_operating: { current: -410291, prior: -450181 },
      cf_capex: { current: -8500, prior: 0 },
      cf_net_investing: { current: -8500, prior: 0 },
      cf_loans: { current: -124837, prior: 97924 },
      cf_share_issue: { current: 1138683, prior: 0 },
      cf_net_financing: { current: 1013846, prior: 97924 },
      cf_net_change: { current: 595055, prior: -352257 },
      cf_opening_cash: { current: 140135, prior: 424639 },
      cf_closing_cash: { current: 735189, prior: 72382 },
    });

    const gm = metrics.find((m) => m.id === "gross_margin");
    expect(gm?.value).toBeCloseTo(81.7, 1);
    const runway = metrics.find((m) => m.id === "cash_runway_months");
    expect(runway?.value).toBeGreaterThan(10);
  });
});
