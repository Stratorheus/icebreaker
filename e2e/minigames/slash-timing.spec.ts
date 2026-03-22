import { test, expect } from "@playwright/test";
import { openTraining } from "../helpers/training";

test.describe("Slash Timing", () => {
  test("success — press Space during attack phase", async ({ page }) => {
    await openTraining(page, "Slash Timing", "TRIVIAL");

    // Wait for the attack phase (green) to appear
    const phaseEl = page.locator('[data-testid="slash-phase"]');
    await expect(phaseEl).toHaveAttribute("data-phase", "attack", { timeout: 10000 });

    // Press Space during attack phase
    await page.keyboard.press("Space");

    // Verify success
    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — press Space during guard phase", async ({ page }) => {
    await openTraining(page, "Slash Timing", "TRIVIAL");

    // Wait for the guard phase
    const phaseEl = page.locator('[data-testid="slash-phase"]');
    await expect(phaseEl).toHaveAttribute("data-phase", "guard", { timeout: 10000 });

    // Press Space immediately during guard phase
    await page.keyboard.press("Space");

    // Verify failure
    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
