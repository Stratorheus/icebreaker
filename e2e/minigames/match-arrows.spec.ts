import { test, expect } from "@playwright/test";
import { openTraining } from "../helpers/training";

test.describe("Packet Route (MatchArrows)", () => {
  test("success — press correct arrow keys from data-testid", async ({ page }) => {
    await openTraining(page, "Packet Route", "TRIVIAL");

    // Repeatedly read and press the expected arrow
    for (let i = 0; i < 15; i++) {
      const hint = page.locator('[data-testid="expected-arrow"]');
      const key = await hint.getAttribute("data-key", { timeout: 5000 });
      if (!key) break;

      await page.keyboard.press(key);
      await page.waitForTimeout(100);

      // Check if success appeared
      const success = page.getByText("SUCCESS");
      if (await success.isVisible().catch(() => false)) break;
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — press wrong arrow key", async ({ page }) => {
    await openTraining(page, "Packet Route", "TRIVIAL");

    // Read expected arrow and press wrong one
    const hint = page.locator('[data-testid="expected-arrow"]');
    const key = await hint.getAttribute("data-key", { timeout: 5000 });

    const allArrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    const wrongKey = allArrows.find((k) => k !== key) ?? "ArrowUp";
    await page.keyboard.press(wrongKey);

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
