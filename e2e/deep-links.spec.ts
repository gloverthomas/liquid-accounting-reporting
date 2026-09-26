import { expect, test } from "@playwright/test";

test.describe("Report deep links", () => {
  test("legacy #sales-summary opens Revenue summary without an error (LIQ-9)", async ({ page }) => {
    await page.goto("/#sales-summary");
    await expect(page.getByRole("heading", { name: "Revenue summary" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page).toHaveURL(/#revenue-summary$/);
  });

  test("canonical #revenue-summary opens the report", async ({ page }) => {
    await page.goto("/#revenue-summary");
    await expect(page.getByRole("heading", { name: "Revenue summary" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("an unknown hash still explains itself", async ({ page }) => {
    await page.goto("/#no-such-report");
    await expect(page.getByRole("alert")).toContainText("No report is registered for #no-such-report");
  });
});
