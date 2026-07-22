import fs from "node:fs";
import { test, expect } from "@playwright/test";
import {
  HY_PDF,
  loginAsAdmin,
  expectSectionMetricsAndCharts,
  expectStatementTables,
  SECTION_METRIC_LABELS,
} from "./helpers";

test.describe("@slow ingest and board report", () => {
  test("upload PDF, approve, view full HY2026 report", async ({ page }) => {
    test.setTimeout(600_000);
    expect(fs.existsSync(HY_PDF), `Missing fixture PDF at ${HY_PDF}`).toBeTruthy();

    await loginAsAdmin(page);
    await page.goto("/admin/ingest");
    await expect(page.getByRole("heading", { name: /ingest/i })).toBeVisible();

    // Wipe any already-approved HY2026 pack so we exercise a real extract → approve path.
    // (Approve button only renders for status === "extracted".)
    page.once("dialog", (dialog) => dialog.accept());
    const clearSelect = page.locator("#clear-period");
    if (await clearSelect.isVisible().catch(() => false)) {
      const values = await clearSelect.locator("option").evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value),
      );
      if (values.includes("hy2026")) {
        await clearSelect.selectOption("hy2026");
        await page.getByRole("button", { name: /Remove pack/i }).click();
        await expect(page.getByRole("button", { name: /Upload & extract/i })).toBeVisible({
          timeout: 60_000,
        });
      }
    }

    await page.locator('select[name="periodId"]').selectOption("hy2026");

    await page.locator('input[type="file"]').setInputFiles(HY_PDF);
    await page.getByRole("button", { name: /Upload & extract|Re-extract from PDF/i }).click();
    await expect(page.getByRole("button", { name: /Extracting/i })).toBeVisible({
      timeout: 15_000,
    });

    // Succeed only when a fresh extract is ready to approve; fail loudly on Claude/Zod errors.
    const approveBtn = page.getByRole("button", { name: /Approve & calculate metrics/i });
    const extractError = page.getByText(/Extraction failed|Zod validation|Forbidden|Choose a PDF/i);
    await expect(approveBtn.or(extractError).first()).toBeVisible({ timeout: 300_000 });
    if (await extractError.isVisible().catch(() => false)) {
      const detail = await extractError.first().innerText();
      throw new Error(`PDF extract failed (file was uploaded from docs/): ${detail}`);
    }
    await expect(approveBtn).toBeEnabled();
    await expect(page.getByText(/Latest job:.*status\s+extracted/i)).toBeVisible();

    await approveBtn.click();
    await expect(page.getByRole("tab", { name: /Insights/i })).toBeVisible({ timeout: 120_000 });
    await page.getByRole("tab", { name: /Insights/i }).click();

    for (const section of Object.keys(SECTION_METRIC_LABELS)) {
      await expect(page.getByRole("heading", { name: new RegExp(`^${section}$`, "i") })).toBeVisible({
        timeout: 300_000,
      });
    }

    const approveAll = page.getByRole("button", { name: /Approve all generated/i });
    await expect(approveAll).toBeEnabled({ timeout: 300_000 });
    await approveAll.click();
    await expect(page).toHaveURL(/\/reports\/hy2026/, { timeout: 60_000 });

    await expect(page.getByRole("heading", { name: "Senus PLC" })).toBeVisible();
    await expect(page.getByText(/·\s*Admin/i)).toBeVisible();

    const comparing = page.locator("#report-period");
    await expect(comparing).toBeVisible();
    const options = await comparing.locator("option").allTextContents();
    expect(options.some((o) => /HY2026\s+vs\s+HY2025/i.test(o))).toBeTruthy();
    expect(options.some((o) => /HY2024\s+vs\s+HY2025/i.test(o))).toBeFalsy();

    for (const id of Object.keys(SECTION_METRIC_LABELS) as (keyof typeof SECTION_METRIC_LABELS)[]) {
      await expectSectionMetricsAndCharts(page, id);
    }
    await expectStatementTables(page);

    await expect(page.getByText(/354[,.]?813/).first()).toBeVisible();
    await expect(page.getByText(/340[,.]?931/).first()).toBeVisible();
  });
});
