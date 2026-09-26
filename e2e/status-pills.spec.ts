import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const proofDir = join(process.cwd(), "e2e/proof");

// Must match Core's .status pill (src/styles.css in liquid-accounting-core).
const CORE_PILL = { borderRadius: "999px", fontSize: "11px", fontWeight: "600" };

test("Revenue summary status pills use Core's pill styles (LIQ-7)", async ({ page }) => {
  mkdirSync(proofDir, { recursive: true });
  await page.goto("/#revenue-summary");
  const overdue = page.locator("span.status", { hasText: "Overdue" });
  await expect(overdue).toBeVisible();
  await expect(page.locator(".chip")).toHaveCount(0);

  const style = await overdue.evaluate((el) => {
    const s = getComputedStyle(el);
    return { borderRadius: s.borderTopLeftRadius, fontSize: s.fontSize, fontWeight: s.fontWeight, color: s.color, background: s.backgroundColor };
  });
  expect(style).toMatchObject(CORE_PILL);
  expect(style.color).toBe("rgb(255, 41, 46)");
  expect(style.background).toBe("rgb(255, 240, 240)");
  await page.locator(".report-table-card").screenshot({ path: join(proofDir, "liq-7-reporting-status-pills.png") });
});
