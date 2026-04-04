import { test, expect } from "@playwright/test";
import { openTraining, unlockMinigames } from "../helpers/training";
import { skipOnboarding } from "../helpers/setup";

const DIR_TO_KEY: Record<string, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

test.describe("Signal Echo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["signal-echo"]);
  });

  test("success — repeat echo sequence from data-testid", async ({ page }) => {
    await openTraining(page, "Signal Echo", "TRIVIAL");

    // SignalEcho has display + input phases across multiple rounds.
    // At trivial difficulty: starts with 1 signal, 3 rounds total.
    for (let round = 0; round < 10; round++) {
      // Wait for input phase
      await expect(
        page.locator('[data-testid="echo-phase"][data-phase="input"]'),
      ).toBeVisible({ timeout: 10000 });

      // Read the sequence from the hidden helper
      const seqEl = page.locator('[data-testid="echo-sequence"]');
      const seqJson = await seqEl.getAttribute("data-sequence", { timeout: 5000 });
      if (!seqJson) break;

      const sequence: string[] = JSON.parse(seqJson);

      // Press each direction in the sequence
      for (const dir of sequence) {
        const key = DIR_TO_KEY[dir];
        if (key) {
          await page.keyboard.press(key);
          await page.waitForTimeout(200);
        }
      }

      // Check if success appeared (all rounds complete)
      const success = page.getByText("SUCCESS");
      if (await success.isVisible().catch(() => false)) break;

      // Wait for display phase animation before next input round
      await page.waitForTimeout(500);
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 15000 });
  });

  test("fail — press wrong direction during input phase", async ({ page }) => {
    await openTraining(page, "Signal Echo", "TRIVIAL");

    // Wait for input phase
    await expect(
      page.locator('[data-testid="echo-phase"][data-phase="input"]'),
    ).toBeVisible({ timeout: 10000 });

    // Read the sequence
    const seqEl = page.locator('[data-testid="echo-sequence"]');
    const seqJson = await seqEl.getAttribute("data-sequence", { timeout: 5000 });
    const sequence: string[] = JSON.parse(seqJson ?? "[]");

    // Press wrong direction
    const expectedDir = sequence[0] ?? "up";
    const allDirs = ["up", "down", "left", "right"];
    const wrongDir = allDirs.find((d) => d !== expectedDir) ?? "down";
    const wrongKey = DIR_TO_KEY[wrongDir];

    await page.keyboard.press(wrongKey);

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
