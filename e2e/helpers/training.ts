import type { Page } from "@playwright/test";

/**
 * Navigate to Training and start a minigame.
 * Flow: Menu → TRAINING (picker) → pick minigame → briefing → select difficulty → BEGIN TRAINING → countdown → GO
 */
export async function openTraining(page: Page, minigameDisplayName: string, difficulty = "NORMAL") {
  await page.goto("/");
  await page.getByText("TRAINING").click();
  await page.locator('[data-testid="minigame-picker-item"]').filter({ hasText: minigameDisplayName }).click();
  await page.locator(`[data-testid="difficulty-option"][data-value="${difficulty}"]`).click();
  await page.locator('[data-testid="begin-training"]').click();
  // Countdown shows 3-2-1-GO then instantly transitions to active phase.
  // "GO" is only visible for one render frame — too fast for Playwright.
  // Instead, wait for the QUIT button which appears in active phase.
  await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300); // Allow minigame component to mount and initialize after phase transition
}

/**
 * Quit training via the quit button + confirmation modal.
 */
export async function quitTraining(page: Page) {
  await page.locator('[data-testid="quit-training-button"]').click();
  await page.locator('[data-testid="confirm-quit"]').click();
}

/**
 * Inject purchased upgrades into localStorage.
 */
export async function setMetaUpgrades(page: Page, upgrades: Record<string, number>) {
  await page.evaluate((ups) => {
    const raw = localStorage.getItem("icebreaker-meta");
    const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    meta.state.purchasedUpgrades = { ...meta.state.purchasedUpgrades, ...ups };
    localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
  }, upgrades);
  await page.reload();
}

/**
 * Unlock non-starting minigames in localStorage so they appear in the Training picker.
 */
export async function unlockMinigames(page: Page, minigameTypes: string[]) {
  await page.evaluate((types) => {
    const raw = localStorage.getItem("icebreaker-meta");
    const meta = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    const current: string[] = meta.state.unlockedMinigames ?? [];
    const merged = [...new Set([...current, ...types])];
    meta.state.unlockedMinigames = merged;
    localStorage.setItem("icebreaker-meta", JSON.stringify(meta));
  }, minigameTypes);
  await page.reload();
}

/**
 * Open Training with upgrades enabled at specific tiers.
 */
export async function openTrainingWithUpgrades(
  page: Page,
  minigameDisplayName: string,
  upgrades: Record<string, number>,
  upgradeNamesToEnable: string[],
  difficulty = "NORMAL"
) {
  await setMetaUpgrades(page, upgrades);
  await page.goto("/");
  await page.getByText("TRAINING").click();
  await page.locator('[data-testid="minigame-picker-item"]').filter({ hasText: minigameDisplayName }).click();
  for (const name of upgradeNamesToEnable) {
    await page.locator(`[data-testid="upgrade-card"]`).filter({ hasText: name }).locator('[data-testid="upgrade-checkbox"]').click();
  }
  await page.locator(`[data-testid="difficulty-option"][data-value="${difficulty}"]`).click();
  await page.locator('[data-testid="begin-training"]').click();
  // Wait for active phase (QUIT button appears when minigame is running)
  await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
}
