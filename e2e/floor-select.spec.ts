import { test, expect, type Page } from "@playwright/test";
import { setMetaUpgrades } from "./helpers/training";

// ---------------------------------------------------------------------------
// Helper: inject checkpointReaches into localStorage and reload
// ---------------------------------------------------------------------------

async function injectCheckpoints(page: Page, reaches: Record<string, number>) {
  await page.evaluate((r) => {
    const raw = localStorage.getItem("icebreaker-meta");
    const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    meta.state.checkpointReaches = r;
    localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
  }, reaches);
  await page.reload();
}

// ===========================================================================
// FLOOR SELECT TESTS
// ===========================================================================

test.describe("Floor Select", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // -------------------------------------------------------------------------
  // 1. Floor picker shows when checkpoints unlocked
  // -------------------------------------------------------------------------
  test("floor picker shows unlocked checkpoints", async ({ page }) => {
    // Inject checkpointReaches: floor 5 reached 2x (unlocked)
    await injectCheckpoints(page, { "5": 2 });

    // Click START RUN — should show floor picker (2+ checkpoints)
    await page.getByText("START RUN").click();

    // Floor 1 and Floor 5 should be visible
    await expect(page.getByText("FLOOR 1")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("FLOOR 5")).toBeVisible({ timeout: 3000 });

    // BEGIN RUN button should be visible
    await expect(page.getByText("BEGIN RUN")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Starting on higher floor gives bonus credits
  // -------------------------------------------------------------------------
  test("starting on floor 10 gives bonus credits in HUD", async ({ page }) => {
    // Inject checkpoints for floor 5 and floor 10
    await injectCheckpoints(page, { "5": 2, "10": 2 });

    // Open floor picker and select floor 10
    await page.getByText("START RUN").click();
    await page.getByText("FLOOR 10").click();
    await page.getByText("BEGIN RUN").click();

    // Wait for minigame
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });

    // Check credits in store — should be getStartingCredits(0) + getFloorBonusCredits(10) = 25 + 280 = 305
    const credits = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );
    expect(credits).toBe(305);
  });

  // -------------------------------------------------------------------------
  // 3. No picker when only floor 1 available
  // -------------------------------------------------------------------------
  test("no floor picker when only floor 1 available", async ({ page }) => {
    // Clear any checkpoint data
    await injectCheckpoints(page, {});

    // Click START RUN — should go directly to game (no picker)
    await page.getByText("START RUN").click();

    // Should be in the minigame directly
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
  });
});

// ===========================================================================
// VENDOR SHOP SLOT COUNT TESTS (supply-line upgrade)
// ===========================================================================

test.describe("Vendor Shop Slots", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // -------------------------------------------------------------------------
  // 4. Vendor shop has 2 items by default (no supply-line)
  // -------------------------------------------------------------------------
  test("vendor shop has 2 items by default (no supply-line)", async ({ page }) => {
    // Start run via store, skip to shop
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.getState().startRun();
    });
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.getState().generateRunShop(1);
      store.setState({ status: "shop" });
    });

    await page.getByText("VENDOR NODE").waitFor({ timeout: 5000 });

    // Count shop item BUY buttons — should be 2
    const items = await page.locator("button:has-text('BUY')").count();
    expect(items).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 5. Supply-line tier 1 gives 4 items
  // -------------------------------------------------------------------------
  test("supply-line tier 1 gives 4 vendor items", async ({ page }) => {
    await setMetaUpgrades(page, { "supply-line": 1 });

    // Start run via store, skip to shop
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.getState().startRun();
    });
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.getState().generateRunShop(1);
      store.setState({ status: "shop" });
    });

    await page.getByText("VENDOR NODE").waitFor({ timeout: 5000 });

    // Count shop item BUY buttons — should be 4
    const items = await page.locator("button:has-text('BUY')").count();
    expect(items).toBe(4);
  });
});
