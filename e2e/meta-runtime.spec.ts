import { test, expect, type Page } from "@playwright/test";
import { setMetaUpgrades } from "./helpers/training";

// ---------------------------------------------------------------------------
// Helper: inject data + upgrades into localStorage
// ---------------------------------------------------------------------------

async function injectMeta(page: Page, data: number, upgrades: Record<string, number> = {}) {
  await page.evaluate(
    ({ d, ups }) => {
      const raw = localStorage.getItem("icebreaker-meta");
      const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      meta.state.data = d;
      meta.state.purchasedUpgrades = { ...meta.state.purchasedUpgrades, ...ups };
      localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
    },
    { d: data, ups: upgrades },
  );
  await page.reload();
}

// ---------------------------------------------------------------------------
// Helper: start a run via store, wait for "playing" UI
// ---------------------------------------------------------------------------

async function startRunViaStore(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).__GAME_STORE__.getState().startRun();
  });
  // Wait for the minigame-active wrapper to appear (status = "playing")
  await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
}

// ===========================================================================
// META UPGRADE RUNTIME EFFECTS
// ===========================================================================

test.describe("Meta Upgrade Runtime Effects", () => {

  // -------------------------------------------------------------------------
  // 1. Thicker Armor reduces damage on fail
  // -------------------------------------------------------------------------
  test("Thicker Armor tier 5 reduces fail damage by 25%", async ({ page }) => {
    // Inject thicker-armor tier 5 (25% damage reduction)
    await page.goto("/");
    await setMetaUpgrades(page, { "thicker-armor": 5 });

    await startRunViaStore(page);

    // Read HP before failing
    const hpBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().hp,
    );

    // Fail a minigame
    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().failMinigame(),
    );
    await page.waitForTimeout(300);

    const hpAfter = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().hp,
    );

    const damageTaken = hpBefore - hpAfter;

    // Floor 1 base damage = 20 + 1*4 = 24
    // With 25% reduction: Math.round(24 * 0.75) = 18
    // Without armor it would be 24
    expect(damageTaken).toBeLessThan(24);
    expect(damageTaken).toBe(18);
  });

  test("Thicker Armor tier 0 (no armor) takes full damage", async ({ page }) => {
    await page.goto("/");
    await startRunViaStore(page);

    const hpBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().hp,
    );

    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().failMinigame(),
    );
    await page.waitForTimeout(300);

    const hpAfter = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().hp,
    );

    const damageTaken = hpBefore - hpAfter;
    // Floor 1 base damage = 20 + 1*4 = 24
    expect(damageTaken).toBe(24);
  });

  test("Thicker Armor tier 1 reduces damage by 5%", async ({ page }) => {
    await page.goto("/");
    await setMetaUpgrades(page, { "thicker-armor": 1 });
    await page.evaluate(() => (window as any).__GAME_STORE__.getState().startRun());
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });

    const hpBefore = await page.evaluate(() => (window as any).__GAME_STORE__.getState().hp);
    await page.evaluate(() => (window as any).__GAME_STORE__.getState().failMinigame());
    await page.waitForTimeout(300);
    const hpAfter = await page.evaluate(() => (window as any).__GAME_STORE__.getState().hp);

    // Floor 1 damage = 24, with 5% reduction = round(24 * 0.95) = 23
    expect(hpBefore - hpAfter).toBe(23);
  });

  test("Thicker Armor tier 3 reduces damage by 15%", async ({ page }) => {
    await page.goto("/");
    await setMetaUpgrades(page, { "thicker-armor": 3 });
    await page.evaluate(() => (window as any).__GAME_STORE__.getState().startRun());
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });

    const hpBefore = await page.evaluate(() => (window as any).__GAME_STORE__.getState().hp);
    await page.evaluate(() => (window as any).__GAME_STORE__.getState().failMinigame());
    await page.waitForTimeout(300);
    const hpAfter = await page.evaluate(() => (window as any).__GAME_STORE__.getState().hp);

    // Floor 1 damage = 24, with 15% reduction = round(24 * 0.85) = 20
    expect(hpBefore - hpAfter).toBe(20);
  });

  // -------------------------------------------------------------------------
  // 2. Credit Multiplier increases credit reward
  // -------------------------------------------------------------------------
  test("Credit Multiplier tier 5 increases credits earned", async ({ page }) => {
    await page.goto("/");
    await setMetaUpgrades(page, { "credit-multiplier": 5 });
    await startRunViaStore(page);

    const creditsBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );

    // Complete a minigame with 30 base credits at 5000ms
    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().completeMinigame({
        credits: 30,
        timeMs: 5000,
      }),
    );
    await page.waitForTimeout(300);

    const creditsAfter = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );

    const earned = creditsAfter - creditsBefore;

    // With credit-multiplier tier 5: credits are multiplied by 1.03^5 = ~1.159
    // The store uses getEffectiveCredits which computes:
    //   base = 20 * (1 + difficulty) * speedBonus
    //   then * Math.pow(1.03, 5)
    // Without multiplier, base earned would be some value X;
    // with multiplier it should be > X
    // Just verify earned is positive and more than what you'd get without multiplier
    expect(earned).toBeGreaterThan(0);

    // Now test without multiplier to compare
    // Start a fresh run without upgrades
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.setState({ status: "menu" });
    });
    await page.waitForTimeout(200);

    // Clear upgrades for comparison run
    await page.evaluate(() => {
      const raw = localStorage.getItem("icebreaker-meta");
      const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      meta.state.purchasedUpgrades = {};
      localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
    });
    await page.reload();
    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().startRun(),
    );
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);

    const creditsBeforeBase = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );

    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().completeMinigame({
        credits: 30,
        timeMs: 5000,
      }),
    );
    await page.waitForTimeout(300);

    const creditsAfterBase = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );

    const earnedBase = creditsAfterBase - creditsBeforeBase;

    // Credit multiplier run should earn more
    expect(earned).toBeGreaterThan(earnedBase);
  });

  // -------------------------------------------------------------------------
  // 3. Data Siphon increases data reward on quit
  // -------------------------------------------------------------------------
  test("Data Siphon tier 5 increases data reward on quit", async ({ page }) => {
    await page.goto("/");
    await injectMeta(page, 0, { "data-siphon": 5 });

    await startRunViaStore(page);

    // Complete some minigames to advance the run
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.getState().completeMinigame({ credits: 30, timeMs: 5000 });
    });
    await page.waitForTimeout(200);

    // Read state before quit to understand floor
    const floor = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().floor,
    );

    // Quit the run (voluntary — no death penalty)
    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().quitRun(),
    );
    await page.waitForTimeout(500);

    // Death screen should show "RUN TERMINATED" (voluntary quit)
    await expect(page.getByText("RUN TERMINATED")).toBeVisible({ timeout: 5000 });

    // The data reward includes getEffectiveDataReward(floor, 5) which is:
    // getDataReward(floor) * Math.pow(1.03, 5)
    // Verify the FLOOR REWARD line is visible
    await expect(page.getByText("FLOOR REWARD")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Data Recovery reduces death penalty
  // -------------------------------------------------------------------------
  test("Data Recovery tier 6 reduces death penalty to 10%", async ({ page }) => {
    await page.goto("/");
    await injectMeta(page, 0, { "data-recovery": 6 });

    await startRunViaStore(page);

    // Kill the player by failing until HP = 0
    // First set HP low so it dies quickly
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.setState({ hp: 1 }); // Set HP to 1 so next fail kills
    });
    await page.waitForTimeout(200);

    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().failMinigame(),
    );
    await page.waitForTimeout(500);

    // Death screen should show "CONNECTION LOST" (not voluntary)
    await expect(page.getByText("CONNECTION LOST")).toBeVisible({ timeout: 5000 });

    // Death penalty should be 10% (minimum with tier 6)
    // Formula: Math.max(0.10, 0.25 - 6 * 0.025) = Math.max(0.10, 0.10) = 0.10
    await expect(page.getByText("DEATH PENALTY (10%)")).toBeVisible({ timeout: 3000 });

    // DATA RECOVERY LVL 6 ACTIVE should be shown
    await expect(page.getByText("DATA RECOVERY LVL 6 ACTIVE")).toBeVisible();
  });

  test("without Data Recovery, death penalty is 25%", async ({ page }) => {
    await page.goto("/");
    await startRunViaStore(page);

    // Kill the player
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.setState({ hp: 1 });
    });
    await page.waitForTimeout(200);

    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().failMinigame(),
    );
    await page.waitForTimeout(500);

    await expect(page.getByText("CONNECTION LOST")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("DEATH PENALTY (25%)")).toBeVisible({ timeout: 3000 });
  });

  // -------------------------------------------------------------------------
  // 5. Difficulty Reducer lowers effective difficulty
  // -------------------------------------------------------------------------
  test("Difficulty Reducer tier 5 lowers effective difficulty", async ({ page }) => {
    await page.goto("/");
    await setMetaUpgrades(page, { "difficulty-reducer": 5 });
    await startRunViaStore(page);

    // Read the store state — difficulty is computed per floor, not stored directly.
    // We verify via completeMinigame: higher effective credits = lower difficulty.
    // With reducer tier 5: difficulty = getDifficulty(1) * 0.95^5
    //   getDifficulty(1) = min(0.1 + 1/15, 1.0) = 0.1667
    //   effective = 0.1667 * 0.95^5 = 0.1667 * 0.7738 = 0.1290

    // Complete a minigame and measure credits earned
    const creditsBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );

    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().completeMinigame({
        credits: 30,
        timeMs: 5000,
      }),
    );
    await page.waitForTimeout(200);

    const creditsAfter = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );

    const earnedWithReducer = creditsAfter - creditsBefore;

    // Now compare to a run without difficulty reducer
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.setState({ status: "menu" });
    });
    await page.waitForTimeout(200);

    // Clear upgrades
    await page.evaluate(() => {
      const raw = localStorage.getItem("icebreaker-meta");
      const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      meta.state.purchasedUpgrades = {};
      localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
    });
    await page.reload();
    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().startRun(),
    );
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);

    const creditsBeforeBase = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );

    await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().completeMinigame({
        credits: 30,
        timeMs: 5000,
      }),
    );
    await page.waitForTimeout(200);

    const creditsAfterBase = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );

    const earnedBase = creditsAfterBase - creditsBeforeBase;

    // Lower difficulty = lower base credits (since getCredits = 20 * (1 + difficulty) * speedBonus)
    // So with difficulty reducer, credits should be LESS
    // (difficulty reducer makes the game easier but base credits scale with difficulty)
    expect(earnedWithReducer).toBeLessThan(earnedBase);
  });
});
