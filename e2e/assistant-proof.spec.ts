import { expect, test } from "@playwright/test";

test("Reporting AI Assistant opens but send fails (LIQ-24)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /AI Assistant/i }).click();
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
  await page.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByRole("alert")).toContainText(/unavailable in Reporting/i, { timeout: 10_000 });
});
