import { test, expect } from "@playwright/test";
import { openTraining, unlockMinigames } from "../helpers/training";

test.describe("Wire Cutting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await unlockMinigames(page, ["wire-cutting"]);
  });

  test("success — click wires in correct order using data-next", async ({ page }) => {
    await openTraining(page, "Wire Cutting", "TRIVIAL");

    // Cut wires one by one by finding the one with data-next="true"
    for (let i = 0; i < 10; i++) {
      const nextWire = page.locator('[data-testid="wire"][data-next="true"]');
      const count = await nextWire.count();
      if (count === 0) break;

      await nextWire.first().click();
      await page.waitForTimeout(200);

      // Check if success appeared
      const success = page.getByText("SUCCESS");
      if (await success.isVisible().catch(() => false)) break;
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — click wrong wire", async ({ page }) => {
    await openTraining(page, "Wire Cutting", "TRIVIAL");

    // Click a wire where data-next="false"
    const wrongWire = page.locator('[data-testid="wire"][data-next="false"]');
    await wrongWire.first().click();

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
