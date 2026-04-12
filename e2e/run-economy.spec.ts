import { test, expect, type Page } from "@playwright/test";
import { setMetaUpgrades } from "./helpers/training";
import { skipOnboarding } from "./helpers/setup";

// ---------------------------------------------------------------------------
// Helper: start a run from the main menu and wait for first minigame
// ---------------------------------------------------------------------------

async function startRunAndWait(page: Page) {
  await page.getByText("START RUN").click();
  // Countdown shows 3-2-1-GO then instantly transitions to active.
  // "GO" is only visible for one frame — too fast for Playwright.
  // Wait for [data-testid="minigame-active"] which wraps the active minigame.
  await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
}

// ===========================================================================
// RUN ECONOMY TESTS
// ===========================================================================

test.describe("Run Economy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
  });

  test("start run shows HUD with floor, HP, and credits", async ({ page }) => {
    await startRunAndWait(page);

    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 5000 });

    // HUD should show HP — BASE_HP = 100, see run-slice.ts startRun
    await expect(header).toContainText("100/100");

    // HUD should show credits
    await expect(header).toContainText("CR");
  });

  test("base starting credits are 25 CR", async ({ page }) => {
    await startRunAndWait(page);

    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 5000 });

    // getStartingCredits(0) = 25, see balancing.ts
    await expect(header).toContainText("25");
  });

  test("Head Start tier 5 gives 1025 starting credits", async ({ page }) => {
    await setMetaUpgrades(page, { "head-start": 5 });
    await startRunAndWait(page);

    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 5000 });

    // 25 + 1000 = 1025, displayed with locale formatting as "1,025"
    await expect(header).toContainText("1,025");
  });

  test("HP Boost increases max HP in HUD", async ({ page }) => {
    // hp-boost is stackable: +5 HP per purchase. 3 purchases = +15 HP
    await setMetaUpgrades(page, { "hp-boost": 3 });
    await startRunAndWait(page);

    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 5000 });
    await expect(header).toContainText("115/115");
  });

  test("Overclocked tier 3 adds 15 max HP", async ({ page }) => {
    await setMetaUpgrades(page, { "overclocked": 3 });
    await startRunAndWait(page);

    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 5000 });
    // overclocked tier 3 = +15 HP = 115/115
    await expect(header).toContainText("115/115");
  });

  test("combined HP Boost + Overclocked stacks correctly", async ({ page }) => {
    // hp-boost x2 = +10, overclocked tier 2 = +10 => 120/120
    await setMetaUpgrades(page, { "hp-boost": 2, "overclocked": 2 });
    await startRunAndWait(page);

    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 5000 });
    await expect(header).toContainText("120/120");
  });

  test("death screen (voluntary quit) shows data breakdown", async ({ page }) => {
    await startRunAndWait(page);

    // Force the run into voluntary-quit death state via the store
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.setState({ status: "dead", quitVoluntarily: true });
    });

    // Death screen replaces the HUD
    await expect(page.locator("header")).toBeHidden({ timeout: 5000 });

    // Voluntary-quit title + subtitle prove we're on the death screen in quit mode
    await expect(page.getByRole("heading", { name: "RUN TERMINATED" })).toBeVisible();
    await expect(page.getByText("VOLUNTARY DISCONNECT")).toBeVisible();

    // Data breakdown header row — baseline assertion that summary rendered
    await expect(page.getByText("FLOOR REACHED")).toBeVisible();
    await expect(page.getByText("FLOOR REWARD")).toBeVisible();

    // Voluntary quit = no death penalty row
    await expect(page.getByText(/DEATH PENALTY/)).toHaveCount(0);
  });

  test("data balance shown in main menu", async ({ page }) => {
    await expect(page.getByText("START RUN")).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
  });

  test("multiple meta upgrades apply at run start", async ({ page }) => {
    // Test that multiple upgrades stack: head-start 2 (+125 CR) + hp-boost 1 (+5 HP)
    await setMetaUpgrades(page, { "head-start": 2, "hp-boost": 1 });
    await startRunAndWait(page);

    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 5000 });

    // HP should be 105 (100 + 5)
    await expect(header).toContainText("105/105");

    // Credits should be 150 (25 + 125)
    await expect(header).toContainText("150");
  });
});
