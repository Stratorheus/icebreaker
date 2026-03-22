import { test, expect } from "@playwright/test";
import { openTraining } from "../helpers/training";

test.describe("Code Inject (CloseBrackets)", () => {
  test("success — type correct closing brackets", async ({ page }) => {
    await openTraining(page, "Code Inject", "TRIVIAL");

    // Repeatedly read the expected closer and press the correct key
    for (let i = 0; i < 10; i++) {
      const hint = page.locator('[data-testid="expected-closer"]');
      const key = await hint.getAttribute("data-key", { timeout: 5000 });
      if (!key) break; // all brackets closed

      await page.keyboard.press(key);

      // Small delay for state to update
      await page.waitForTimeout(100);

      // Check if done
      const nextKey = await hint.getAttribute("data-key");
      if (nextKey === "") break;
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
