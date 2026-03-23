import { test, expect } from "@playwright/test";
import { openTraining } from "../helpers/training";

test.describe("Code Inject (CloseBrackets)", () => {
  test("success — type correct closing brackets", async ({ page }) => {
    await openTraining(page, "Code Inject", "TRIVIAL");

    // Wait a moment for the game to fully initialize
    await page.waitForTimeout(500);

    // Repeatedly read the expected closer and dispatch keydown event
    for (let i = 0; i < 40; i++) {
      const hint = page.locator('[data-testid="expected-closer"]');
      const key = await hint.getAttribute("data-key", { timeout: 2000 }).catch(() => null);
      if (!key) break;

      // Dispatch raw keydown event — useKeyboard listens for event.key
      await page.evaluate((k) => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      }, key);
      await page.waitForTimeout(120);

      // Check if game ended
      const done = await page.getByText("SUCCESS").or(page.getByText("FAILED")).isVisible().catch(() => false);
      if (done) break;
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
