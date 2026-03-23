import { test, expect } from "@playwright/test";
import { openTraining, unlockMinigames } from "../helpers/training";

test.describe("Port Scan", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await unlockMinigames(page, ["port-scan"]);
  });

  test("success — select all open ports during select phase", async ({ page }) => {
    await openTraining(page, "Port Scan", "TRIVIAL");

    // Wait for the select phase (after display/flash phase)
    await expect(
      page.locator('[data-testid="port-phase"][data-phase="select"]'),
    ).toBeVisible({ timeout: 15000 });

    // Click all port cells where data-open="true"
    const openPorts = page.locator('[data-testid="port-cell"][data-open="true"]');
    const count = await openPorts.count();

    for (let i = 0; i < count; i++) {
      await openPorts.nth(i).click();
      await page.waitForTimeout(200);
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — select a closed port during select phase", async ({ page }) => {
    await openTraining(page, "Port Scan", "TRIVIAL");

    // Wait for the select phase
    await expect(
      page.locator('[data-testid="port-phase"][data-phase="select"]'),
    ).toBeVisible({ timeout: 15000 });

    // Click a closed port
    const closedPorts = page.locator('[data-testid="port-cell"][data-open="false"]');
    await closedPorts.first().click();

    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 10000 });
  });
});
