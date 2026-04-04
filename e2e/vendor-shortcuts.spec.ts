import { test, expect } from "@playwright/test";
import { skipOnboarding } from "./helpers/setup";

// ---------------------------------------------------------------------------
// Helper: start a run and navigate directly to the vendor (shop) screen.
// Mirrors the pattern used in run-shop.spec.ts.
// ---------------------------------------------------------------------------

async function reachVendor(
  page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown
    ? P
    : never,
) {
  await page.evaluate(() => {
    const store = (window as any).__GAME_STORE__;
    store.getState().startRun();
  });
  await page.locator('[data-testid="minigame-active"]').waitFor({
    timeout: 8000,
  });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const store = (window as any).__GAME_STORE__;
    store.getState().generateRunShop(1);
    store.setState({ status: "shop" });
  });

  await expect(page.getByText("VENDOR NODE")).toBeVisible({ timeout: 5000 });
}

// ===========================================================================
// VENDOR KEYBOARD SHORTCUT TESTS
// ===========================================================================

test.describe("Vendor keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
  });

  // -------------------------------------------------------------------------
  // 1. Space key advances to next floor from vendor
  // -------------------------------------------------------------------------
  test("Space key advances to next floor from vendor", async ({ page }) => {
    await reachVendor(page);

    // Read current floor (should be 1)
    const floorBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().floor,
    );
    expect(floorBefore).toBe(1);

    // Press Space — shortcut calls advanceFloor() when view === "shop"
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);

    // Floor should have advanced to 2
    const floorAfter = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().floor,
    );
    expect(floorAfter).toBe(floorBefore + 1);
  });

  // -------------------------------------------------------------------------
  // 2. Escape key opens quit confirmation in vendor
  // -------------------------------------------------------------------------
  test("Escape key opens quit confirmation in vendor", async ({ page }) => {
    await reachVendor(page);

    // Before pressing Escape, quit confirmation should not be visible
    await expect(page.getByText("QUIT?")).not.toBeVisible();

    // Press Escape — toggles confirmQuit state → shows "QUIT?" + CONFIRM button
    await page.keyboard.press("Escape");

    // Quit confirmation text should now appear
    await expect(page.getByText("QUIT?")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("CONFIRM")).toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 3. Space does not advance floor when in Codex sub-view
  // -------------------------------------------------------------------------
  test("Space does not advance floor when in Codex sub-view", async ({
    page,
  }) => {
    await reachVendor(page);

    // Open Codex sub-view — button text is "CODEX"
    const codexBtn = page.getByRole("button", { name: "CODEX" });
    await expect(codexBtn).toBeVisible({ timeout: 3000 });
    await codexBtn.click();
    await page.waitForTimeout(300);

    // Verify we're in Codex by checking for the back button
    await expect(
      page.getByRole("button", { name: /BACK TO VENDOR/i }),
    ).toBeVisible({ timeout: 3000 });

    const floorBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().floor,
    );

    // Press Space — should NOT advance floor because view !== "shop"
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);

    const floorAfter = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().floor,
    );
    expect(floorAfter).toBe(floorBefore);
  });
});
