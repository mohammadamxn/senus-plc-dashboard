import { test, expect } from "@playwright/test";

test.describe("route guards", () => {
  test("logged-out report redirects to login", async ({ page }) => {
    await page.goto("/reports/hy2026");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("forgot password page is viewable logged out", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /reset your password/i })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });
});
