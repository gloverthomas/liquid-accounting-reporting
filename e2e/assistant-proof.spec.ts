import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const proofDir = join(process.cwd(), "e2e/proof");

// Needs the Reporting BFF (npm run api) behind the dev server, like Core's assistant spec.
test("Reporting AI Assistant answers like Core (LIQ-24)", async ({ page }) => {
  mkdirSync(proofDir, { recursive: true });
  await page.goto("/");
  await page.getByRole("button", { name: /AI Assistant/i }).click();
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
  await page.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByText(/last quarter/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("alert")).toHaveText(/related questions failed to render/i);
  await page.getByRole("button", { name: /How this was calculated/i }).click();
  await expect(page.getByText(/via /i)).toBeVisible();
  await page.screenshot({ path: join(proofDir, "liq-37-reporting-assistant-calculation-accordion.png") });
});
