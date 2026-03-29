import { test, expect } from "@playwright/test";
import { openTraining, unlockMinigames } from "../helpers/training";

test.describe("Defrag", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await unlockMinigames(page, ["defrag"]);
  });

  test("success — uncover safe cells, first click is always safe", async ({ page }) => {
    await openTraining(page, "Defrag", "TRIVIAL");

    // First click: always safe. Mines are placed after first click.
    // Click the first cell to trigger mine placement
    const firstCell = page.locator('[data-testid="cell"]').first();
    await firstCell.click();
    await page.waitForTimeout(300);

    // After first click, mines are placed. Now uncover all safe cells.
    // Read all cells and click those with data-mine="false" that aren't revealed yet.
    // Since this is minesweeper with flood fill, the first click may reveal many cells.
    // Keep clicking unrevealed safe cells until success.
    for (let attempt = 0; attempt < 50; attempt++) {
      const safeCells = page.locator('[data-testid="cell"][data-mine="false"]');
      const count = await safeCells.count();
      let clickedAny = false;

      for (let i = 0; i < count; i++) {
        const cell = safeCells.nth(i);
        // Check if the cell button is still clickable (not disabled, hidden state)
        const isDisabled = await cell.isDisabled().catch(() => true);
        if (isDisabled) continue;

        // Check if cell text is the dot character (still hidden)
        const text = await cell.textContent();
        if (text?.includes("·")) {
          await cell.click();
          clickedAny = true;
          await page.waitForTimeout(100);
          break;
        }
      }

      // Check for success
      const success = page.getByText("SUCCESS");
      if (await success.isVisible().catch(() => false)) break;

      if (!clickedAny) break;
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — click a mine cell", async ({ page }) => {
    // Use HARD difficulty so the board has enough mines that first-click
    // flood fill won't clear all safe cells and auto-win the game.
    // TRIVIAL (4×4, 1 mine) nearly always auto-completes on first click.
    await openTraining(page, "Defrag", "HARD");

    // First click is always safe (mines placed after)
    const firstCell = page.locator('[data-testid="cell"]').first();
    await firstCell.click();

    // Wait for mines to be placed and rendered (data-mine attributes appear after first click)
    const mineCells = page.locator('[data-testid="cell"][data-mine="true"]');
    await mineCells.first().waitFor({ timeout: 3000 });

    // Click a mine cell to trigger fail
    await mineCells.first().click();

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
