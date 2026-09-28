import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const proofDir = join(process.cwd(), "e2e/proof");

const fixtureReply = {
  reply:
    "Income is up versus last quarter, and net profit improved as coffee wholesale held steady.\n\n1. **Income** – $56,180 this quarter vs $48,210 last quarter\n2. **Net profit** – $24,202 vs $18,640\n\nFigures use Liquid Coffee Co. demo books (AUD).",
  provider: "fixture",
  rationale: "Compared current quarter income and net profit against last quarter from demo books.",
  relatedQuestions: [
    "What's driving the income increase?",
    "What's my gross profit margin?",
    "What are my biggest income sources?",
  ],
};

test("Reporting AI Assistant lists a saved chat and restores the reply", async ({ page }) => {
  mkdirSync(proofDir, { recursive: true });

  await page.route(/\/api\/v1\/assistant\/chat$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtureReply),
    });
  });

  await page.goto("/#revenue-summary");
  await page.getByRole("button", { name: /AI Assistant/i }).click();
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();

  await page.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByText(/Income is up versus last quarter/i).first()).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "History" }).click();
  const history = page.getByRole("list", { name: "Chat history" });
  await expect(
    history.getByRole("button", { name: "How does this quarter compare to last?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByRole("heading", { name: /Hello/i })).toBeVisible();
  await expect(page.getByText(/Income is up versus last quarter/i)).toHaveCount(0);

  await page.getByRole("button", { name: "History" }).click();
  await history.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByText(/Income is up versus last quarter/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "What's driving the income increase?" })).toBeVisible();

  await page.screenshot({
    path: join(proofDir, "liq-41-reporting-chat-history.png"),
    fullPage: false,
  });
});
