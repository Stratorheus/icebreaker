import { test, expect } from "@playwright/test";
import { openTraining } from "../helpers/training";

test.describe("Memory Scan (MineSweep)", () => {
  test("success — mark all mine cells during mark phase", async ({ page }) => {
    await openTraining(page, "Memory Scan", "TRIVIAL");

    // Wait for the mark phase (preview auto-transitions after a few seconds)
    await expect(page.getByText("marked", { exact: false }).first()).toBeVisible({ timeout: 10000 });

    // Find all cells where data-mine="true" and click them
    const mineCells = page.locator('[data-testid="cell"][data-mine="true"]');
    const count = await mineCells.count();

    for (let i = 0; i < count; i++) {
      await mineCells.nth(i).click();
      await page.waitForTimeout(150);
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — mark a non-mine cell during mark phase", async ({ page }) => {
    await openTraining(page, "Memory Scan", "TRIVIAL");

    // Wait for mark phase
    await expect(page.getByText("marked", { exact: false }).first()).toBeVisible({ timeout: 10000 });

    // Click a safe (non-mine) cell — this should cause immediate fail
    const safeCells = page.locator('[data-testid="cell"][data-mine="false"]');
    await safeCells.first().click();

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
