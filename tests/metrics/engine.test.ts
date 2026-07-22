import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  ebitdaToFcfBridge,
  validateStatementIntegrity,
  costBreakdown,
  cashWalk,
} from "@/modules/metrics/engine";
import { readFileSync } from "fs";
import path from "path";

const statement = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "content/seed/statements/hy2026.json"),
    "utf8",
  ),
);

describe("metrics engine", () => {
  it("computes gross margin ~81.7%", () => {
    const metrics = computeMetrics(statement.lines);
    const gm = metrics.find((m) => m.id === "gross_margin");
    expect(gm?.value).toBeCloseTo(81.7, 1);
    expect(gm?.meaningfulness).toBe("ok");
  });

  it("computes revenue growth ~4.1%", () => {
    const metrics = computeMetrics(statement.lines);
    const g = metrics.find((m) => m.id === "revenue_growth_yoy");
    expect(g?.value).toBeCloseTo(4.07, 1);
  });

  it("computes cash runway from operating burn", () => {
    const metrics = computeMetrics(statement.lines);
    const runway = metrics.find((m) => m.id === "cash_runway_months");
    expect(runway?.value).toBeGreaterThan(10);
    expect(runway?.value).toBeLessThan(12);
  });

  it("marks operating margin as not_meaningful while loss-making", () => {
    const metrics = computeMetrics(statement.lines);
    const om = metrics.find((m) => m.id === "operating_margin");
    expect(om?.meaningfulness).toBe("not_meaningful");
  });

  it("builds FCF bridge ending at net op + capex", () => {
    const bridge = ebitdaToFcfBridge(statement.lines);
    const fcf = bridge.find((b) => b.id === "fcf");
    expect(fcf?.amount).toBeCloseTo(-410291 + -8500, 0);
  });

  it("passes statement integrity checks", () => {
    expect(validateStatementIntegrity(statement.lines)).toEqual([]);
  });

  it("computes current ratio ~2.39x and flips <1x with contingent consideration", () => {
    const metrics = computeMetrics(statement.lines);
    const cr = metrics.find((m) => m.id === "current_ratio");
    const crIncl = metrics.find((m) => m.id === "current_ratio_incl_earnout");
    expect(cr?.value).toBeCloseTo(2.39, 1);
    expect(crIncl?.value).toBeLessThan(1);
  });

  it("computes gearing from creditors after one year over equity", () => {
    const metrics = computeMetrics(statement.lines);
    const g = metrics.find((m) => m.id === "gearing");
    const bankDebt = Math.abs(statement.lines.creditors_after_one_year.current);
    const equity = statement.lines.equity.current;
    expect(g?.value).toBeCloseTo((bankDebt / equity) * 100, 1);
    expect(g?.meaningfulness).toBe("ok");
  });

  it("computes net cash from cash minus creditors after one year", () => {
    const metrics = computeMetrics(statement.lines);
    const net = metrics.find((m) => m.id === "net_cash");
    const expected =
      statement.lines.cash.current - Math.abs(statement.lines.creditors_after_one_year.current);
    expect(net?.value).toBeCloseTo(expected, 0);
  });

  it("flags ROCE as not_meaningful while loss-making", () => {
    const metrics = computeMetrics(statement.lines);
    const roce = metrics.find((m) => m.id === "roce");
    expect(roce?.value).toBeLessThan(0);
    expect(roce?.meaningfulness).toBe("not_meaningful");
  });

  it("suppresses DSCR value while EBITDA is non-positive", () => {
    const metrics = computeMetrics(statement.lines);
    const dscr = metrics.find((m) => m.id === "dscr");
    expect(dscr?.value).toBeNull();
    expect(dscr?.meaningfulness).toBe("degenerate");
  });

  it("cost breakdown is dominated by administrative expenses", () => {
    const costs = costBreakdown(statement.lines);
    const components = costs.filter((c) => c.id !== "total");
    const top = [...components].sort((a, b) => b.amount - a.amount)[0];
    expect(top.id).toBe("administrative_expenses");
    expect(top.amount).toBe(781975);
    const total = costs.find((c) => c.id === "total");
    expect(total?.amount).toBeGreaterThan(top.amount);
  });

  it("cash walk starts at opening and ends at closing cash", () => {
    const walk = cashWalk(statement.lines);
    expect(walk[0]).toMatchObject({ id: "opening", amount: 140135 });
    expect(walk[walk.length - 1]).toMatchObject({ id: "closing", amount: 735189 });
  });
});
