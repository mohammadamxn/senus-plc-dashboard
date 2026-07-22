import { test, expect } from "@playwright/test";
import { loginAsAdmin, adminCredentials } from "./helpers";

test.describe("users admin", () => {
  test("lists users, shows Admin for self, delete opens modal", async ({ page }) => {
    const { email } = adminCredentials();
    await loginAsAdmin(page);
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Role" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Remove" })).toBeVisible();

    const selfCell = page.getByText(email, { exact: false }).first();
    await expect(selfCell).toBeVisible();
    await expect(page.getByText("(you)")).toBeVisible();

    const selfRow = page.locator("tr", { has: page.getByText("(you)") });
    await expect(selfRow.getByText("Admin", { exact: true })).toBeVisible();
    await expect(selfRow.getByRole("button", { name: "Remove" })).toBeDisabled();
    await expect(selfRow.getByRole("button", { name: "Revoke admin" })).toBeDisabled();

    const otherRemove = page
      .locator("tr")
      .filter({ hasNot: page.getByText("(you)") })
      .getByRole("button", { name: "Remove" })
      .first();

    if (await otherRemove.count()) {
      await otherRemove.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "Delete user?" })).toBeVisible();
      await expect(dialog.getByText(/Are you sure you want to delete this user/)).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
    }
  });
});
