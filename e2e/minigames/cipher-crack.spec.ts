import { test, expect } from "@playwright/test";
import { openTraining, unlockMinigames } from "../helpers/training";

test.describe("Cipher Crack V1", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await unlockMinigames(page, ["cipher-crack"]);
  });

  test("success — type correct characters from expected-char", async ({ page }) => {
    await openTraining(page, "Cipher Crack V1", "TRIVIAL");

    // Repeatedly read the expected character and type it
    for (let i = 0; i < 20; i++) {
      const hint = page.locator('[data-testid="expected-char"]');
      const char = await hint.getAttribute("data-char", { timeout: 5000 });
      if (!char) break;

      await page.keyboard.press(char);
      await page.waitForTimeout(100);

      // Check if success appeared
      const success = page.getByText("SUCCESS");
      if (await success.isVisible().catch(() => false)) break;
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — type wrong character", async ({ page }) => {
    await openTraining(page, "Cipher Crack V1", "TRIVIAL");

    // Read expected character and type wrong one
    const hint = page.locator('[data-testid="expected-char"]');
    const char = await hint.getAttribute("data-char", { timeout: 5000 });

    const wrongChar = char !== "z" ? "z" : "a";
    await page.keyboard.press(wrongChar);

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
