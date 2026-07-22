import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("invite", () => {
  test("invite form accepts email and audience", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/invite");

    await expect(page.getByRole("heading", { name: "Invite a user" })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#audience")).toBeVisible();

    const unique = `e2e+${Date.now()}@example.com`;
    await page.locator("#email").fill(unique);
    await page.locator("#audience").selectOption("credit");
    await page.getByRole("button", { name: /send invite/i }).click();

    await expect(page.getByText(new RegExp(`Invite sent to ${unique}`, "i"))).toBeVisible({
      timeout: 30_000,
    });
  });
});
