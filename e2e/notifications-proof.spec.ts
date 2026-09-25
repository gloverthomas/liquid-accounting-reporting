import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const proofDir = join(process.cwd(), "e2e/proof");

test("Reporting Notifications open the same menu as Core (LIQ-17)", async ({ page }) => {
  mkdirSync(proofDir, { recursive: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByRole("menu", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Invoice INV-1042 was paid" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Bank feed needs review" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Payroll run is ready" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: join(proofDir, "liq-17-reporting-notifications-open.png"), fullPage: false });

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Notifications" })).toHaveCount(0);
});
