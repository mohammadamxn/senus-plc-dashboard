import { test, expect } from "@playwright/test";
import {
  loginAs,
  skipIfNoPack,
  expectSectionMetricsAndCharts,
  SECTION_METRIC_LABELS,
} from "./helpers";

test.describe("audience report visibility", () => {
  test("credit provider sees profitability, liquidity, solvency metrics and charts only", async ({
    page,
  }) => {
    await loginAs(page, "credit");
    if (await skipIfNoPack(page)) {
      test.skip(true, "No approved HY2026 pack loaded");
    }

    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(page.getByText(/Credit Providers/i)).toBeVisible();

    await expectSectionMetricsAndCharts(page, "profitability");
    await expectSectionMetricsAndCharts(page, "liquidity");
    await expectSectionMetricsAndCharts(page, "solvency");

    // Forbidden sections
    await expect(page.getByRole("heading", { name: /Growth & Revenue/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Returns$/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Financial statements/i })).toHaveCount(0);
    await expect(page.locator("#growth")).toHaveCount(0);
    await expect(page.locator("#returns")).toHaveCount(0);
    await expect(page.locator("#statements")).toHaveCount(0);

    // Forbidden metric labels must not leak into allowed sections
    for (const label of SECTION_METRIC_LABELS.growth) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
    for (const label of ["ROCE (half-year)", "Return on equity (half-year)"]) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/reports\//);
  });

  test("equity investor sees growth, liquidity, returns metrics and charts only", async ({
    page,
  }) => {
    await loginAs(page, "investor");
    if (await skipIfNoPack(page)) {
      test.skip(true, "No approved HY2026 pack loaded");
    }

    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(page.getByText(/Equity Investors/i)).toBeVisible();

    await expectSectionMetricsAndCharts(page, "growth");
    await expectSectionMetricsAndCharts(page, "liquidity");
    await expectSectionMetricsAndCharts(page, "returns");

    await expect(page.getByRole("heading", { name: /^Profitability$/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Solvency & Leverage/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Financial statements/i })).toHaveCount(0);
    await expect(page.locator("#profitability")).toHaveCount(0);
    await expect(page.locator("#solvency")).toHaveCount(0);
    await expect(page.locator("#statements")).toHaveCount(0);

    for (const label of [
      "Gross margin",
      "Group operating loss",
      "Current ratio",
      "DSCR (illustrative)",
    ]) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/reports\//);
  });

  test("admin sees all section metrics, charts, and statements", async ({ page }) => {
    await loginAs(page, "admin");
    if (await skipIfNoPack(page)) {
      test.skip(true, "No approved HY2026 pack loaded");
    }

    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
    for (const id of Object.keys(SECTION_METRIC_LABELS) as (keyof typeof SECTION_METRIC_LABELS)[]) {
      await expectSectionMetricsAndCharts(page, id);
    }
    await expect(page.getByRole("heading", { name: /Financial statements/i })).toBeVisible();
  });
});
