import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const proofDir = join(process.cwd(), "e2e/proof");

test("Reporting Help centre opens (proof screenshot)", async ({ page }) => {
  mkdirSync(proofDir, { recursive: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.getByRole("menu", { name: "Help centre" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Contact support" })).toBeVisible();
  await page.screenshot({ path: join(proofDir, "liq-16-reporting-help-open.png"), fullPage: false });
});
