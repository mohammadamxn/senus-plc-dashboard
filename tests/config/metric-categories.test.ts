import { describe, expect, it } from "vitest";
import {
  CATEGORY_AUDIENCES,
  visibleCategoriesFor,
  isMetricVisibleFor,
  buildMetricAudienceTags,
} from "@/config/metric-categories";

describe("CATEGORY_AUDIENCES policy", () => {
  it("locks in the exact spec: credit gets solvency/liquidity/profitability, equity gets growth/liquidity/returns", () => {
    expect(CATEGORY_AUDIENCES).toEqual({
      growth: ["management", "board", "equity"],
      profitability: ["management", "board", "credit"],
      liquidity: ["management", "board", "credit", "equity"],
      solvency: ["management", "board", "credit"],
      returns: ["management", "board", "equity"],
    });
  });

  it("credit never sees growth or returns", () => {
    const visible = visibleCategoriesFor("credit");
    expect(visible.has("growth")).toBe(false);
    expect(visible.has("returns")).toBe(false);
    expect(visible.has("solvency")).toBe(true);
    expect(visible.has("liquidity")).toBe(true);
    expect(visible.has("profitability")).toBe(true);
  });

  it("equity never sees profitability or solvency", () => {
    const visible = visibleCategoriesFor("equity");
    expect(visible.has("profitability")).toBe(false);
    expect(visible.has("solvency")).toBe(false);
    expect(visible.has("growth")).toBe(true);
    expect(visible.has("liquidity")).toBe(true);
    expect(visible.has("returns")).toBe(true);
  });

  it("management and board see every category", () => {
    for (const audience of ["management", "board"] as const) {
      const visible = visibleCategoriesFor(audience);
      expect(visible.size).toBe(5);
    }
  });

  it("isMetricVisibleFor matches the category grants for a representative metric per category", () => {
    expect(isMetricVisibleFor("credit", "revenue")).toBe(false); // growth-only
    expect(isMetricVisibleFor("equity", "revenue")).toBe(true);
    expect(isMetricVisibleFor("credit", "gross_margin")).toBe(true); // profitability
    expect(isMetricVisibleFor("equity", "gross_margin")).toBe(false);
    expect(isMetricVisibleFor("credit", "cash")).toBe(true); // liquidity — both get it
    expect(isMetricVisibleFor("equity", "cash")).toBe(true);
    expect(isMetricVisibleFor("credit", "roce")).toBe(false); // returns-only
    expect(isMetricVisibleFor("equity", "roce")).toBe(true);
  });

  it("leaves metrics outside the five named categories visible to everyone", () => {
    expect(isMetricVisibleFor("credit", "bank_debt")).toBe(true);
    expect(isMetricVisibleFor("equity", "bank_debt")).toBe(true);
  });

  it("buildMetricAudienceTags tags ebitda_margin with the union of profitability + returns audiences", () => {
    const tags = buildMetricAudienceTags();
    expect(new Set(tags.ebitda_margin)).toEqual(new Set(["management", "board", "credit", "equity"]));
  });
});
