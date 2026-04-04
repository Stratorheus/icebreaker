import { test, expect } from "@playwright/test";
import { openTraining, unlockMinigames } from "../helpers/training";
import { skipOnboarding } from "../helpers/setup";

test.describe("Address Lookup (FindSymbol)", () => {
  test.beforeEach(async ({ page }) => {
    // FindSymbol is not a starting minigame — unlock it first
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["find-symbol"]);
  });

  test("success — click grid cell matching target symbol", async ({ page }) => {
    await openTraining(page, "Address Lookup", "TRIVIAL");

    // Find each target and click the matching grid cell
    for (let i = 0; i < 10; i++) {
      const targetEl = page.locator('[data-testid="target-symbol"]');
      const count = await targetEl.count();
      if (count === 0) break;

      // Get the target code text from the element
      const targetCode = await targetEl.textContent();
      if (!targetCode) break;

      // Find a grid button with the matching code (not already selected)
      const matchingCell = page.locator("button").filter({ hasText: targetCode.trim() }).first();
      await matchingCell.click();
      await page.waitForTimeout(200);

      // Check if success appeared
      const success = page.getByText("SUCCESS");
      if (await success.isVisible().catch(() => false)) break;
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — click wrong grid cell", async ({ page }) => {
    await openTraining(page, "Address Lookup", "TRIVIAL");

    // Get target code
    const targetEl = page.locator('[data-testid="target-symbol"]');
    const targetCode = await targetEl.textContent({ timeout: 5000 });

    // Find and click a cell that does NOT match the target
    const allButtons = page.locator("button");
    const buttonCount = await allButtons.count();
    for (let i = 0; i < buttonCount; i++) {
      const btn = allButtons.nth(i);
      const text = await btn.textContent();
      if (text && text.trim() !== targetCode?.trim() && text.trim().length === 2) {
        await btn.click();
        break;
      }
    }

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
