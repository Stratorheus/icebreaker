import { test, expect } from "@playwright/test";
import { openTraining, unlockMinigames } from "../helpers/training";
import { skipOnboarding } from "../helpers/setup";

test.describe("Subnet Scan", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["subnet-scan"]);
  });

  test("success — select all correct addresses", async ({ page }) => {
    await openTraining(page, "Subnet Scan", "TRIVIAL");

    // Click all address buttons where data-correct="true"
    const correctAddrs = page.locator('[data-testid="address"][data-correct="true"]');
    const count = await correctAddrs.count();

    for (let i = 0; i < count; i++) {
      await correctAddrs.nth(i).click();
      await page.waitForTimeout(200);
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — select an incorrect address", async ({ page }) => {
    await openTraining(page, "Subnet Scan", "TRIVIAL");

    // Click an address where data-correct="false"
    const wrongAddrs = page.locator('[data-testid="address"][data-correct="false"]');
    await wrongAddrs.first().click();

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
