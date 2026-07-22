import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const HY_PDF = path.join(
  process.cwd(),
  "docs",
  "Senus Notification of Results HY Dec 2025.pdf",
);

export function adminCredentials() {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local to run Playwright e2e.");
  }
  return { email, password };
}

export async function loginAsAdmin(page: Page) {
  const { email, password } = adminCredentials();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/reports\//);
  await expect(page.getByText(/·\s*Admin/i)).toBeVisible();
}
