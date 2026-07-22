import { test, expect } from "@playwright/test";
import { HY_PDF, loginAsAdmin } from "./helpers";

test.describe("@slow ingest and board report", () => {
  test("upload PDF, approve, view full HY2026 report", async ({ page }) => {
    test.setTimeout(600_000);
    await loginAsAdmin(page);

    await page.goto("/admin/ingest");
    await expect(page.getByRole("heading", { name: /ingest/i })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles(HY_PDF);
    await page.getByRole("button", { name: /extract|upload/i }).first().click();

    await expect(page.getByText(/HY2026|extracted|statement/i).first()).toBeVisible({
      timeout: 300_000,
    });
    await expect(page.getByRole("button", { name: /Approve.*metrics/i })).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole("button", { name: /Approve.*metrics/i }).click();
    await expect(page.getByText(/growth|profitability|liquidity|generating|insight/i).first()).toBeVisible({
      timeout: 120_000,
    });

    // Wait for commentary sections or approve-all availability
    await expect(page.getByRole("heading", { name: /^growth$/i })).toBeVisible({
      timeout: 300_000,
    });
    await expect(page.getByRole("heading", { name: /^profitability$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^liquidity$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^solvency$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^returns$/i })).toBeVisible();

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

    await expect(page.getByRole("heading", { name: /Growth & Revenue/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Profitability$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Cash & Liquidity/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Solvency & Leverage/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Returns$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Financial statements/i })).toBeVisible();

    // PDF headline figures (UI may format with commas / €)
    await expect(page.getByText(/354[,.]?813/).first()).toBeVisible();
    await expect(page.getByText(/340[,.]?931/).first()).toBeVisible();

    // Chart / table affordances in growth
    await expect(page.locator("#growth")).toBeVisible();
    await expect(page.locator("#profitability")).toBeVisible();
    await expect(page.locator("#liquidity")).toBeVisible();
    await expect(page.locator("#solvency")).toBeVisible();
    await expect(page.locator("#returns")).toBeVisible();
    await expect(page.locator("#statements")).toBeVisible();
  });
});
