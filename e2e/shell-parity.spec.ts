import { expect, test } from "@playwright/test";

// Same labels, same order as Core's primary navigation (liquid-accounting-core src/main.tsx).
const CORE_NAV = ["Dashboard", "Create", "Sales", "Purchases", "Banking", "Contacts", "Reports"];

test("primary navigation matches Core's labels and order (LIQ-8)", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.locator('a[title="Create"]')).toBeVisible();
  await expect(nav.locator('a[title="New"]')).toHaveCount(0);
  const labels = (await nav.locator(".sidebar-label").allTextContents()).map((t) => t.trim());
  expect(labels.filter((t) => CORE_NAV.includes(t))).toEqual(CORE_NAV);
});
