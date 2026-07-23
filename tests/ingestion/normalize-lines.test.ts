import { describe, expect, it } from "vitest";
import { normalizeStatementLines } from "@/modules/ingestion/normalize-lines";

describe("normalizeStatementLines", () => {
  it("maps labels to chart codes", () => {
    const out = normalizeStatementLines([
      { code: "Turnover", current: 1, prior: 2 },
      { code: "Gross Profit", current: 3, prior: 4 },
    ]);
    expect(out).toEqual([
      { code: "turnover", current: 1, prior: 2 },
      { code: "gross_profit", current: 3, prior: 4 },
    ]);
  });

  it("disambiguates shared Interest payable label into PL then CF codes", () => {
    const out = normalizeStatementLines([
      { code: "Interest payable and similar expenses", current: 1391, prior: 1036 },
      { code: "Interest payable and similar expenses", current: 1391, prior: 1036 },
    ]);
    expect(out.map((l) => l.code)).toEqual(["interest_payable", "cf_interest_addback"]);
  });

  it("keeps already-valid unique codes", () => {
    const out = normalizeStatementLines([
      { code: "turnover", current: 1, prior: 0 },
      { code: "cf_interest_addback", current: 2, prior: 0 },
    ]);
    expect(out.map((l) => l.code)).toEqual(["turnover", "cf_interest_addback"]);
  });

  it("drops unmapped codes", () => {
    const out = normalizeStatementLines([{ code: "not_a_real_line", current: 1, prior: 0 }]);
    expect(out).toEqual([]);
  });
});
