import { test, expect } from "@playwright/test";
import { loginAs, signOut, credentialsFor } from "./helpers";

test.describe("login and sign out", () => {
  test("admin can sign in and sign out", async ({ page }) => {
    const { email } = credentialsFor("admin");
    await loginAs(page, "admin");
    await expect(page.getByText(email, { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
    await signOut(page);
    await page.goto("/reports/hy2026");
    await expect(page).toHaveURL(/\/login/);
  });

  test("credit provider can sign in and sign out", async ({ page }) => {
    const { email } = credentialsFor("credit");
    await loginAs(page, "credit");
    await expect(page.getByText(email, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Credit Providers/i)).toBeVisible();
    await signOut(page);
  });

  test("equity investor can sign in and sign out", async ({ page }) => {
    const { email } = credentialsFor("investor");
    await loginAs(page, "investor");
    await expect(page.getByText(email, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Equity Investors/i)).toBeVisible();
    await signOut(page);
  });

  test("wrong password stays on login", async ({ page }) => {
    const { email } = credentialsFor("admin");
    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("DefinitelyWrongPassword1!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
  });
});
