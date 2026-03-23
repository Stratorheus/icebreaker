import { test, expect } from "@playwright/test";
import { openTraining, unlockMinigames } from "../helpers/training";

test.describe("Checksum Verify", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await unlockMinigames(page, ["checksum-verify"]);
  });

  test("success — type correct answer digits and confirm", async ({ page }) => {
    await openTraining(page, "Checksum Verify", "TRIVIAL");

    // Solve each expression
    for (let i = 0; i < 10; i++) {
      const hint = page.locator('[data-testid="expected-answer"]');
      const answer = await hint.getAttribute("data-answer", { timeout: 5000 });
      if (!answer) break;

      // Type each digit (handle negative numbers too)
      for (const char of answer) {
        await page.keyboard.press(char === "-" ? "-" : char);
        await page.waitForTimeout(50);
      }

      // Confirm with Enter
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);

      // Check if success
      const success = page.getByText("SUCCESS");
      if (await success.isVisible().catch(() => false)) break;
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — type wrong answer and confirm", async ({ page }) => {
    await openTraining(page, "Checksum Verify", "TRIVIAL");

    // Read expected answer
    const hint = page.locator('[data-testid="expected-answer"]');
    const answer = await hint.getAttribute("data-answer", { timeout: 5000 });
    const wrongAnswer = String(parseInt(answer ?? "0", 10) + 999);

    // Type wrong answer
    for (const char of wrongAnswer) {
      await page.keyboard.press(char);
      await page.waitForTimeout(50);
    }

    // Confirm
    await page.keyboard.press("Enter");

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
