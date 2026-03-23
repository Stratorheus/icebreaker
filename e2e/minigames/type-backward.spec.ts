import { test, expect } from "@playwright/test";
import { openTraining } from "../helpers/training";

test.describe("Decrypt Signal (TypeBackward)", () => {
  test("success — type correct characters from expected-word", async ({ page }) => {
    await openTraining(page, "Decrypt Signal", "TRIVIAL");

    // Type each word character by character
    for (let wordIdx = 0; wordIdx < 10; wordIdx++) {
      const hint = page.locator('[data-testid="expected-word"]');
      const word = await hint.getAttribute("data-word", { timeout: 5000 });
      if (!word) break;

      // Type each character of the word
      for (const char of word) {
        await page.keyboard.press(char);
        await page.waitForTimeout(50);
      }

      // Check if success appeared
      const success = page.getByText("SUCCESS");
      if (await success.isVisible().catch(() => false)) break;

      await page.waitForTimeout(100);
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — type wrong characters", async ({ page }) => {
    await openTraining(page, "Decrypt Signal", "TRIVIAL");

    // Read expected word then type wrong characters
    const hint = page.locator('[data-testid="expected-word"]');
    const word = await hint.getAttribute("data-word", { timeout: 5000 });

    // Type a character that's definitely wrong (use 'z' if first char is not 'z', else 'a')
    const wrongChar = word && word[0] !== "z" ? "z" : "a";
    await page.keyboard.press(wrongChar);

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
