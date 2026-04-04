import { test, expect, type Page } from "@playwright/test";
import { setMetaUpgrades } from "./helpers/training";
import { skipOnboarding } from "./helpers/setup";

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
    await skipOnboarding(page);
  });

  // -------------------------------------------------------------------------
  // 1. Floor picker shows when checkpoints unlocked
  // -------------------------------------------------------------------------
  test("floor picker shows unlocked checkpoints", async ({ page }) => {
    // Inject checkpointReaches: floor 5 reached 1x (unlocked, threshold=1)
    await injectCheckpoints(page, { "5": 1 });

    // Click START RUN — should show floor picker (unlocked checkpoints)
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
    // Inject checkpoints for floor 5 and floor 10 (threshold=1)
    await injectCheckpoints(page, { "5": 1, "10": 1 });

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

  // -------------------------------------------------------------------------
  // 4. Milestone suppressed on teleported floor
  // -------------------------------------------------------------------------
  test("no milestone awarded on teleported floor", async ({ page }) => {
    // Inject checkpoint for floor 5
    await page.evaluate(() => {
      const raw = localStorage.getItem("icebreaker-meta");
      const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      meta.state.checkpointReaches = { "5": 1 };
      localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
    });
    await page.reload();

    // Start run on floor 5 via store
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.getState().startRun(5);
    });
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });

    // Complete all minigames on floor 5 to trigger end-of-floor
    // Set to last minigame index, then complete it
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      const state = store.getState();
      store.setState({ currentMinigameIndex: state.floorMinigames.length - 1 });
      store.getState().completeMinigame({
        success: true,
        timeMs: 5000,
        minigame: state.floorMinigames[state.floorMinigames.length - 1],
      });
    });
    await page.waitForTimeout(500);

    // Status should be "shop" (not "milestone") — milestone suppressed on teleported floor
    const status = await page.evaluate(() => (window as any).__GAME_STORE__.getState().status);
    expect(status).toBe("shop");

    // milestoneDataThisRun should be 0
    const milestoneData = await page.evaluate(() => (window as any).__GAME_STORE__.getState().milestoneDataThisRun);
    expect(milestoneData).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 5. Checkpoint reach increments on non-teleported milestone
  // -------------------------------------------------------------------------
  test("checkpoint reach increments after clearing milestone floor (walked up)", async ({ page }) => {
    // Clear any existing checkpoints
    await page.evaluate(() => {
      const raw = localStorage.getItem("icebreaker-meta");
      const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      meta.state.checkpointReaches = {};
      localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
    });
    await page.reload();

    // Start run on floor 1, then jump to floor 5 via store
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.getState().startRun(1);
      // Manually set floor to 5 (simulating walking up, startFloor stays 1)
      store.setState({ floor: 5, floorMinigames: ["slash-timing"], currentMinigameIndex: 0 });
    });
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });

    // Complete last minigame on floor 5
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.getState().completeMinigame({
        success: true,
        timeMs: 5000,
        minigame: "slash-timing",
      });
    });
    await page.waitForTimeout(500);

    // Checkpoint reach for floor 5 should be 1
    const reaches = await page.evaluate(() => (window as any).__GAME_STORE__.getState().checkpointReaches[5] ?? 0);
    expect(reaches).toBe(1);

    // Status should be "milestone" (not suppressed, since startFloor=1 < floor=5)
    const status = await page.evaluate(() => (window as any).__GAME_STORE__.getState().status);
    expect(status).toBe("milestone");
  });

  // -------------------------------------------------------------------------
  // 6. Floor bonus credits excluded from data conversion
  // -------------------------------------------------------------------------
  test("floor bonus credits not counted in creditsEarnedThisRun", async ({ page }) => {
    // Inject checkpoint for floor 10
    await page.evaluate(() => {
      const raw = localStorage.getItem("icebreaker-meta");
      const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      meta.state.checkpointReaches = { "5": 1, "10": 1 };
      localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
    });
    await page.reload();

    // Start run on floor 10 via store
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.getState().startRun(10);
    });
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });

    // creditsEarnedThisRun should be 0 (floor bonus is NOT earned credits)
    const earned = await page.evaluate(() => (window as any).__GAME_STORE__.getState().creditsEarnedThisRun);
    expect(earned).toBe(0);

    // But total credits should include the floor bonus
    const credits = await page.evaluate(() => (window as any).__GAME_STORE__.getState().credits);
    // getStartingCredits(0) + getFloorBonusCredits(10) = 25 + 280 = 305
    expect(credits).toBe(305);
  });
});

// ===========================================================================
// VENDOR SHOP SLOT COUNT TESTS (supply-line upgrade)
// ===========================================================================

test.describe("Vendor Shop Slots", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
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

  // -------------------------------------------------------------------------
  // 7. Supply-line tier 2 gives 6 items
  // -------------------------------------------------------------------------
  test("supply-line tier 2 gives 6 vendor items", async ({ page }) => {
    await setMetaUpgrades(page, { "supply-line": 2 });

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

    // Count shop item BUY buttons — should be 6
    const items = await page.locator("button:has-text('BUY')").count();
    expect(items).toBe(6);
  });
});
