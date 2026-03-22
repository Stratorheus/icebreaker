import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helper: inject data into localStorage
// ---------------------------------------------------------------------------

async function injectData(page: Page, amount: number) {
  await page.evaluate((amt) => {
    const raw = localStorage.getItem("icebreaker-meta");
    const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    meta.state.data = amt;
    localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
  }, amount);
  await page.reload();
}

// ===========================================================================
// MINIGAME UNLOCK VERIFICATION
// ===========================================================================

test.describe("Minigame Unlock", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // -------------------------------------------------------------------------
  // 1. Buy minigame license -> appears in Training picker
  // -------------------------------------------------------------------------
  test("buying a minigame license unlocks it in Training picker", async ({ page }) => {
    // Give the player plenty of data to afford the unlock
    await injectData(page, 50000);

    // Go to Meta Shop
    await page.getByText("META SHOP").click();
    await expect(page.getByText("UPGRADE TERMINAL")).toBeVisible({ timeout: 5000 });

    // Find the PROTOCOL LICENSES section
    await expect(page.getByText("PROTOCOL LICENSES")).toBeVisible({ timeout: 3000 });

    // Find an UNLOCK button and click it to buy a license
    // The first available unlock will redirect to Training automatically
    const unlockButtons = page.locator("button:has-text('UNLOCK')");
    await expect(unlockButtons.first()).toBeVisible({ timeout: 3000 });

    // Read which minigames are currently unlocked before purchase
    const unlockedBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().unlockedMinigames.length,
    );

    // Click UNLOCK
    await unlockButtons.first().click();
    await page.waitForTimeout(500);

    // After unlock, the MetaShop redirects to Training (briefing for the new minigame)
    // Verify a new minigame was unlocked
    const unlockedAfter = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().unlockedMinigames.length,
    );
    expect(unlockedAfter).toBeGreaterThan(unlockedBefore);

    // The Training screen should be visible (meta shop sets trainingMinigame + status="training")
    // Navigate back to picker to verify the new game appears in the list
    // First let's check what status we're in
    const status = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().status,
    );
    expect(status).toBe("training");

    // The training screen opens in briefing phase for the newly unlocked minigame
    // Navigate to picker to see the full list
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.getState().setTrainingMinigame(null);
      store.getState().setTrainingOrigin(null);
      store.getState().setStatus("training");
    });
    await page.waitForTimeout(300);

    // The picker should show the newly unlocked minigame
    const pickerItems = page.locator('[data-testid="minigame-picker-item"]');
    const pickerCount = await pickerItems.count();
    // Should be more than the 5 starting minigames (at least 6 now)
    expect(pickerCount).toBeGreaterThan(5);
  });

  // -------------------------------------------------------------------------
  // 2. Unlocked minigame is playable
  // -------------------------------------------------------------------------
  test("unlocked minigame can be played in Training", async ({ page }) => {
    // Unlock Defrag by injecting into localStorage directly
    await page.evaluate(() => {
      const raw = localStorage.getItem("icebreaker-meta");
      const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      meta.state.data = 50000;
      // Add defrag to unlocked minigames
      const current: string[] = meta.state.unlockedMinigames ?? [];
      if (!current.includes("defrag")) {
        meta.state.unlockedMinigames = [...current, "defrag"];
      }
      // Also mark the license as purchased
      meta.state.purchasedUpgrades = {
        ...meta.state.purchasedUpgrades,
        "defrag-license": 1,
      };
      localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
    });
    await page.reload();

    // Navigate to Training
    await page.getByText("TRAINING").click();
    await page.waitForTimeout(300);

    // Find and click Defrag in the picker
    const defragItem = page.locator('[data-testid="minigame-picker-item"]').filter({ hasText: "Defrag" });
    await expect(defragItem).toBeVisible({ timeout: 5000 });
    await defragItem.click();
    await page.waitForTimeout(200);

    // Select difficulty
    await page.locator('[data-testid="difficulty-option"][data-value="TRIVIAL"]').click();

    // Click BEGIN TRAINING
    await page.locator('[data-testid="begin-training"]').click();

    // Wait for active phase
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });

    // The minigame should be running
    const trainingMinigame = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().trainingMinigame,
    );
    expect(trainingMinigame).toBe("defrag");
  });

  // -------------------------------------------------------------------------
  // 3. Multiple unlocks increase picker count
  // -------------------------------------------------------------------------
  test("multiple unlocks all appear in Training picker", async ({ page }) => {
    // Unlock several minigames at once
    await page.evaluate(() => {
      const raw = localStorage.getItem("icebreaker-meta");
      const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      const current: string[] = meta.state.unlockedMinigames ?? [];
      const toUnlock = ["defrag", "wire-cutting", "cipher-crack"];
      const merged = [...new Set([...current, ...toUnlock])];
      meta.state.unlockedMinigames = merged;
      meta.state.purchasedUpgrades = {
        ...meta.state.purchasedUpgrades,
        "defrag-license": 1,
        "wire-cutting-toolkit": 1,
        "cipher-crack-license": 1,
      };
      localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
    });
    await page.reload();

    // Navigate to Training
    await page.getByText("TRAINING").click();
    await page.waitForTimeout(300);

    // Should see all 8 minigames (5 starting + 3 unlocked)
    const pickerItems = page.locator('[data-testid="minigame-picker-item"]');
    const count = await pickerItems.count();
    expect(count).toBe(8);

    // Verify specific unlocked minigames appear
    await expect(
      page.locator('[data-testid="minigame-picker-item"]').filter({ hasText: "Defrag" }),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="minigame-picker-item"]').filter({ hasText: "Wire Cutting" }),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="minigame-picker-item"]').filter({ hasText: "Cipher Crack V1" }),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Unlock bonus: +5 max HP per unlock beyond starting set
  // -------------------------------------------------------------------------
  test("unlocked minigames give +5 max HP bonus per unlock", async ({ page }) => {
    // Unlock 2 extra minigames
    await page.evaluate(() => {
      const raw = localStorage.getItem("icebreaker-meta");
      const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      const current: string[] = meta.state.unlockedMinigames ?? [];
      const toUnlock = ["defrag", "wire-cutting"];
      meta.state.unlockedMinigames = [...new Set([...current, ...toUnlock])];
      localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
    });
    await page.reload();

    // Start a run via store
    await page.evaluate(() => {
      (window as any).__GAME_STORE__.getState().startRun();
    });
    await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);

    // Max HP should be 100 + 2*5 = 110
    const maxHp = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().maxHp,
    );
    expect(maxHp).toBe(110);

    const hp = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().hp,
    );
    expect(hp).toBe(110);
  });
});
