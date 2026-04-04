import { test, expect } from "@playwright/test";
import { skipOnboarding } from "./helpers/setup";

// ---------------------------------------------------------------------------
// Helper: set localStorage meta state and reload.
// ---------------------------------------------------------------------------

async function setMetaState(
  page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never,
  patch: Record<string, unknown>,
) {
  await page.evaluate((p) => {
    const raw = localStorage.getItem("icebreaker-meta");
    const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    Object.assign(meta.state, p);
    localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
  }, patch);
  await page.reload();
}

// ===========================================================================
// ACHIEVEMENT TESTS
// ===========================================================================

test.describe("Achievements", () => {
  // -------------------------------------------------------------------------
  // 1. total-runs achievement triggers on run end (death / quit)
  // -------------------------------------------------------------------------
  test("total-runs achievement triggers on death", async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);

    // Set stats to 9 runs — one below veteran threshold of 10
    await setMetaState(page, {
      stats: {
        totalRuns: 9,
        bestFloor: 0,
        totalMinigamesPlayed: 0,
        totalMinigamesWon: 0,
        totalCreditsEarned: 0,
        totalDataEarned: 0,
        totalPlayTimeMs: 0,
        minigameWinStreaks: {},
        minigameWinsTotal: {},
      },
      achievements: [],
      revealedAchievements: [],
    });

    // Start run via store
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.getState().startRun();
    });
    await page.locator('[data-testid="minigame-active"]').waitFor({
      timeout: 8000,
    });

    // Quit run voluntarily — DeathScreen mounts, useEffect fires updateStats
    // (totalRuns → 10) then evaluateAndAwardAchievements()
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.getState().quitRun();
    });

    // Wait for DeathScreen to mount and the useEffect to fire
    await expect(page.getByText("RUN TERMINATED")).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(500);

    // Veteran (10 total runs) should now be earned
    const hasVeteran = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().achievements.includes("veteran"),
    );
    expect(hasVeteran).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. Near-miss reveals achievement without earning it
  // -------------------------------------------------------------------------
  test("near-miss reveals achievement without earning it", async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);

    // Set stats to 8 runs.
    // After this run ends: totalRuns becomes 9.
    // Near-miss threshold: 10 * 0.8 = 8 → 9 >= 8 → revealed.
    // Earn threshold: 9 >= 10 → false → NOT earned.
    await setMetaState(page, {
      stats: {
        totalRuns: 8,
        bestFloor: 0,
        totalMinigamesPlayed: 0,
        totalMinigamesWon: 0,
        totalCreditsEarned: 0,
        totalDataEarned: 0,
        totalPlayTimeMs: 0,
        minigameWinStreaks: {},
        minigameWinsTotal: {},
      },
      achievements: [],
      revealedAchievements: [],
    });

    // Start and quit run
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.getState().startRun();
    });
    await page.locator('[data-testid="minigame-active"]').waitFor({
      timeout: 8000,
    });
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.getState().quitRun();
    });

    // Wait for DeathScreen and useEffect to complete
    await expect(page.getByText("RUN TERMINATED")).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(500);

    // Veteran should NOT be earned (only 9 runs after this run, need 10)
    const earned = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().achievements.includes("veteran"),
    );
    expect(earned).toBe(false);

    // But it SHOULD be revealed (near-miss: 9 >= 10 * 0.8 = 8)
    const revealed = await page.evaluate(() =>
      (window as any).__GAME_STORE__
        .getState()
        .revealedAchievements.includes("veteran"),
    );
    expect(revealed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. Category badges visible in Stats screen
  // -------------------------------------------------------------------------
  test("category badges displayed in Stats screen", async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);

    // Inject an earned achievement so there's something to show
    await setMetaState(page, {
      achievements: ["first-breach"],
    });

    // Navigate to Stats — main menu button reads ">_ STATS"
    await page.getByText("STATS").click();

    // The CategoryBadge for first-breach renders the text "progression"
    // (first-breach has category: "progression")
    const badge = page.locator("text=progression").first();
    await expect(badge).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 4. Voluntary quit triggers achievements (bug fix verification)
  // -------------------------------------------------------------------------
  test("voluntary quit triggers achievements (bug fix)", async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);

    // Set totalRuns to exactly 2 — one below rookie threshold of 3.
    // After this run ends: totalRuns becomes 3 → rookie earned.
    await setMetaState(page, {
      stats: {
        totalRuns: 2,
        bestFloor: 0,
        totalMinigamesPlayed: 0,
        totalMinigamesWon: 0,
        totalCreditsEarned: 0,
        totalDataEarned: 0,
        totalPlayTimeMs: 0,
        minigameWinStreaks: {},
        minigameWinsTotal: {},
      },
      achievements: [],
      revealedAchievements: [],
    });

    // Start run and voluntarily quit
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.getState().startRun();
    });
    await page.locator('[data-testid="minigame-active"]').waitFor({
      timeout: 8000,
    });
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.getState().quitRun();
    });

    // DeathScreen mounts via quitRun() setting status: "dead".
    // Its useEffect: updateStats (totalRuns → 3) then evaluateAndAwardAchievements.
    // rookie condition: totalRuns >= 3 → true → earned.
    await expect(page.getByText("RUN TERMINATED")).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(500);

    const hasRookie = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().achievements.includes("rookie"),
    );
    expect(hasRookie).toBe(true);
  });
});
