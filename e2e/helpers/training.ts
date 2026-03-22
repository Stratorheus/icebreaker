import type { Page } from "@playwright/test";

/**
 * Navigate to Training and start a minigame.
 * Flow: Menu → TRAINING (picker) → pick minigame → briefing → select difficulty → BEGIN TRAINING → countdown → GO
 */
export async function openTraining(page: Page, minigameDisplayName: string, difficulty = "NORMAL") {
  await page.goto("/");
  await page.getByText("TRAINING").click();
  await page.getByText(minigameDisplayName.toUpperCase()).click();
  await page.getByText(difficulty).click();
  await page.getByText("BEGIN TRAINING").click();
  await page.getByText("GO").waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
}

/**
 * Quit training via the quit button + confirmation modal.
 */
export async function quitTraining(page: Page) {
  await page.getByText("QUIT").first().click();
  await page.getByText("CONFIRM").click();
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
  await page.getByText(minigameDisplayName.toUpperCase()).click();
  for (const name of upgradeNamesToEnable) {
    const card = page.locator(`text=${name}`).locator("..");
    await card.locator('[class*="border"]').first().click();
  }
  await page.getByText(difficulty).click();
  await page.getByText("BEGIN TRAINING").click();
  await page.getByText("GO").waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
}
