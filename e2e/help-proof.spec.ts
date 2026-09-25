import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const proofDir = join(process.cwd(), "e2e/proof");

test("Reporting AI Assistant opens under the top nav (LIQ-24 proof)", async ({ page }) => {
  mkdirSync(proofDir, { recursive: true });
  await page.goto("/");
  await page.getByRole("button", { name: /AI Assistant/i }).click();
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
  await expect(page.getByRole("button", { name: /AI Assistant/i })).toBeVisible();
  await page.screenshot({ path: join(proofDir, "liq-24-reporting-assistant-open.png"), fullPage: false });
});
