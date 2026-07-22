import { test, expect } from "@playwright/test";
import {
  loginAsAdmin,
  expectSectionMetricsAndCharts,
  expectStatementTables,
  SECTION_METRIC_LABELS,
} from "./helpers";

/**
 * View assertions against an already-approved HY2026 pack (no Claude).
 * Skips if the pack is not loaded yet — run the @slow ingest spec first.
 */
test.describe("board report view", () => {
  test("HY2026 report shows every section metric table row, chart, and statements", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/reports/hy2026");
    await page.waitForLoadState("domcontentloaded");

    const unavailable = page.getByRole("heading", { name: /not available yet/i });
    if (await unavailable.isVisible().catch(() => false)) {
      test.skip(true, "No approved HY2026 pack — run e2e/ingest-report.spec.ts first");
    }

    await expect(page.getByRole("heading", { name: "Senus PLC" })).toBeVisible();
    await expect(page.getByText(/·\s*Admin/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();

    const comparing = page.locator("#report-period");
    await expect(comparing).toBeVisible();
    const options = await comparing.locator("option").allTextContents();
    expect(options.every((o) => !/HY2024\s+vs\s+HY2025/i.test(o))).toBeTruthy();
    expect(options.some((o) => /HY2026\s+vs\s+HY2025/i.test(o))).toBeTruthy();

    for (const title of [
      /Growth & Revenue/i,
      /^Profitability$/i,
      /Cash & Liquidity/i,
      /Solvency & Leverage/i,
      /^Returns$/i,
      /Financial statements/i,
    ]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }

    for (const id of Object.keys(SECTION_METRIC_LABELS) as (keyof typeof SECTION_METRIC_LABELS)[]) {
      await expectSectionMetricsAndCharts(page, id);
    }

    await expectStatementTables(page);

    await expect(page.getByText(/354[,.]?813/).first()).toBeVisible();
    await expect(page.getByText(/340[,.]?931/).first()).toBeVisible();
  });
});
