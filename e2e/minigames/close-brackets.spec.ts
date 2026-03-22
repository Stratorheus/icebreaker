import { test, expect } from "@playwright/test";
import { openTraining } from "../helpers/training";

test.describe("Code Inject (CloseBrackets)", () => {
  test("success — type correct closing brackets", async ({ page }) => {
    await openTraining(page, "Code Inject", "TRIVIAL");

    // Repeatedly read the expected closer and type it (not press — some are special chars)
    for (let i = 0; i < 30; i++) {
      const hint = page.locator('[data-testid="expected-closer"]');
      const isVisible = await hint.isVisible().catch(() => false);
      if (!isVisible) break;

      const key = await hint.getAttribute("data-key");
      if (!key) break;

      // Use page.keyboard.type for single characters (handles > / | etc.)
      await page.keyboard.type(key);
      await page.waitForTimeout(80);

      // Check if SUCCESS appeared (game might end mid-loop)
      const success = await page.getByText("SUCCESS").isVisible().catch(() => false);
      if (success) break;
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — press wrong bracket key", async ({ page }) => {
    await openTraining(page, "Code Inject", "TRIVIAL");

    // Read the expected closer
    const hint = page.locator('[data-testid="expected-closer"]');
    const key = await hint.getAttribute("data-key", { timeout: 5000 });

    // Press a wrong bracket key
    const wrongKeys = [")", "]", "}", ">", "/"].filter((k) => k !== key);
    await page.keyboard.press(wrongKeys[0]);

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
