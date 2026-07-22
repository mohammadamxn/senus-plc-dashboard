import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("auth and admin hub", () => {
  test("unauthenticated /admin redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("admin can open hub and sees Admin badge", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ingest PDF" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Manage users" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invite user" })).toBeVisible();
    await expect(
      page.getByText("Upload financial or reference documents for a period"),
    ).toBeVisible();
    await expect(page.getByText("Change roles and admin status.")).toBeVisible();
    await expect(page.getByText("Send an invite with a fixed audience.")).toBeVisible();
  });
});
