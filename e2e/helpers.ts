import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const HY_PDF = path.join(
  process.cwd(),
  "docs",
  "Senus Notification of Results HY Dec 2025.pdf",
);

export type AudienceRole = "admin" | "credit" | "investor";
export type CategoryId = "growth" | "profitability" | "liquidity" | "solvency" | "returns";

/** Labels rendered by `buildComparisonMetrics` for each report section table/chart. */
export const SECTION_METRIC_LABELS: Record<CategoryId, string[]> = {
  growth: ["Turnover", "Gross profit", "Administrative expenses"],
  profitability: [
    "Gross margin",
    "Operating margin",
    "EBITDA margin",
    "Group operating loss",
    "EBITDA (approx.)",
  ],
  liquidity: [
    "Cash & equivalents",
    "Monthly operating cash burn",
    "Cash runway",
    "Working capital",
    "Net cash / (debt)",
  ],
  solvency: [
    "Current ratio",
    "Gearing (bank debt / equity)",
    "Net cash / (debt)",
    "Equity",
    "DSCR (illustrative)",
  ],
  returns: ["ROCE (half-year)", "Return on equity (half-year)", "EBITDA margin"],
};

const CASH_WALK_ROWS = [
  "Opening cash",
  "Operating activities",
  "Investing activities",
  "Financing activities",
  "Closing cash",
];

const STATEMENT_LINES = {
  pl: ["Turnover", "Gross Profit", "Group operating loss", "Loss for the period"],
  bs: [
    "Cash and cash equivalents",
    "Total Fixed Assets",
    "Equity attributable to owners of the company",
  ],
  cf: [
    "Net Cash used in operating activities",
    "Cash and cash equivalent at end of period",
  ],
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name} in .env.local to run Playwright e2e.`);
  }
  return value;
}

export function credentialsFor(role: AudienceRole): { email: string; password: string } {
  if (role === "admin") {
    return {
      email: requireEnv("E2E_ADMIN_EMAIL"),
      password: requireEnv("E2E_ADMIN_PASSWORD"),
    };
  }
  if (role === "credit") {
    return {
      email: requireEnv("CREDIT_EMAIL"),
      password: requireEnv("CREDIT_PASSWORD"),
    };
  }
  return {
    email: requireEnv("INVESTOR_EMAIL"),
    password: requireEnv("INVESTOR_PASSWORD"),
  };
}

export function adminCredentials() {
  return credentialsFor("admin");
}

export async function loginAs(page: Page, role: AudienceRole) {
  const { email, password } = credentialsFor(role);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await Promise.all([
    page.waitForURL(/\/reports\//, { timeout: 90_000 }),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByText(email, { exact: false }).first()).toBeVisible({ timeout: 60_000 });
  await expect(accountSummary(page)).toBeVisible({ timeout: 60_000 });
  if (role === "admin") {
    await expect(page.getByText(/·\s*Admin/i)).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  }
}

export async function loginAsAdmin(page: Page) {
  await loginAs(page, "admin");
}

function accountSummary(page: Page) {
  return page.locator("details summary").filter({ hasText: /^Account/ });
}

export async function signOut(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  const summary = accountSummary(page);
  await expect(summary).toBeVisible({ timeout: 60_000 });
  await summary.click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

export async function skipIfNoPack(page: Page) {
  await page.goto("/reports/hy2026");
  await page.waitForLoadState("domcontentloaded");
  const unavailable = page.getByRole("heading", { name: /not available yet/i });
  if (await unavailable.isVisible().catch(() => false)) {
    return true;
  }
  return false;
}

/**
 * Assert every expected metric appears in the section table, then switch to Chart
 * and assert a titled card + chart surface for each metric.
 */
export async function expectSectionMetricsAndCharts(
  page: Page,
  sectionId: CategoryId,
  labels: string[] = SECTION_METRIC_LABELS[sectionId],
) {
  const section = page.locator(`#${sectionId}`);
  await expect(section).toBeVisible();
  await section.scrollIntoViewIfNeeded();

  const tableBtn = section.getByRole("button", { name: "Table" });
  const chartBtn = section.getByRole("button", { name: "Chart" });
  await expect(tableBtn).toBeVisible();
  await expect(chartBtn).toBeVisible();

  // Default is table — wait until the client toggle is hydrated (SSR HTML alone
  // is not interactive; early clicks leave aria-pressed stuck on Table).
  await tableBtn.scrollIntoViewIfNeeded();
  await expect(async () => {
    await tableBtn.click();
    await expect(tableBtn).toHaveAttribute("aria-pressed", "true");
  }).toPass({ timeout: 30_000 });
  await expect(section.getByRole("columnheader", { name: "Metric" })).toBeVisible();

  for (const label of labels) {
    await expect(
      section.locator("tbody tr").filter({ hasText: label }).first(),
      `missing table row for ${sectionId}: ${label}`,
    ).toBeVisible();
  }

  if (sectionId === "liquidity") {
    await expect(section.getByRole("heading", { name: /Cash movement walk/i })).toBeVisible();
    for (const row of CASH_WALK_ROWS) {
      await expect(section.locator("tbody tr").filter({ hasText: row }).first()).toBeVisible();
    }
    await expect(
      section.getByRole("heading", { name: /EBITDA → Free cash flow bridge/i }),
    ).toBeVisible();
  }

  await chartBtn.scrollIntoViewIfNeeded();
  await expect(async () => {
    await chartBtn.click();
    await expect(chartBtn).toHaveAttribute("aria-pressed", "true");
  }).toPass({ timeout: 30_000 });
  await expect(section.getByRole("columnheader", { name: "Metric" })).toHaveCount(0);

  for (const label of labels) {
    await expect(
      section.locator("p").filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`, "i") }).first(),
      `missing chart card for ${sectionId}: ${label}`,
    ).toBeVisible();
  }

  // Recharts surfaces (n/m placeholders skip ChartContainer for some ratios).
  await expect(section.locator('[data-slot="chart"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(section.locator(".recharts-responsive-container, .recharts-surface").first()).toBeVisible();

  if (sectionId === "liquidity") {
    await expect(section.getByText(/Cash movement walk \(/i)).toBeVisible();
    await expect(section.getByText(/EBITDA → FCF bridge \(/i)).toBeVisible();
    expect(await section.locator('[data-slot="chart"]').count()).toBeGreaterThanOrEqual(
      labels.length + 2,
    );
  } else {
    expect(await section.locator('[data-slot="chart"]').count()).toBeGreaterThanOrEqual(1);
  }

  // Leave table view for any later table assertions
  await expect(async () => {
    await tableBtn.click();
    await expect(tableBtn).toHaveAttribute("aria-pressed", "true");
  }).toPass({ timeout: 15_000 });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function expectStatementTables(page: Page) {
  const section = page.locator("#statements");
  await expect(section).toBeVisible();
  await section.scrollIntoViewIfNeeded();

  await section.getByRole("tab", { name: /Profit & loss/i }).click();
  await expect(section.getByRole("heading", { name: /Consolidated profit and loss/i })).toBeVisible();
  for (const line of STATEMENT_LINES.pl) {
    await expect(section.getByText(line, { exact: true }).first()).toBeVisible();
  }

  await section.getByRole("tab", { name: /Balance sheet/i }).click();
  await expect(section.getByRole("heading", { name: /Consolidated balance sheet/i })).toBeVisible();
  for (const line of STATEMENT_LINES.bs) {
    await expect(section.getByText(line, { exact: true }).first()).toBeVisible();
  }

  await section.getByRole("tab", { name: /Cash flow/i }).click();
  await expect(section.getByRole("heading", { name: /Consolidated cash flow/i })).toBeVisible();
  for (const line of STATEMENT_LINES.cf) {
    await expect(section.getByText(line, { exact: true }).first()).toBeVisible();
  }
}
