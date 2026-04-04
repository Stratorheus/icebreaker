import { test, expect } from "@playwright/test";

test.describe("Onboarding", () => {
  test("shows briefing on first visit and dismisses after 3 steps", async ({ page }) => {
    await page.goto("/");
    // Clear localStorage to simulate first visit
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Briefing should be visible
    await expect(page.getByText("SYSTEM BRIEFING")).toBeVisible();
    await expect(page.getByText(/You're a hacker/)).toBeVisible();

    // Step 1 → 2
    await page.click("body");
    await expect(page.getByText(/Survive floors to earn DATA/)).toBeVisible();

    // Step 2 → 3
    await page.click("body");
    await expect(page.getByText(/Hit START RUN/)).toBeVisible();

    // Step 3 → dismiss via BEGIN button
    await page.getByText(/BEGIN/).click();

    // Menu should now be visible
    await expect(page.getByText("START RUN")).toBeVisible();
  });

  test("does NOT show briefing on second visit", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Complete onboarding
    await page.click("body");
    await page.click("body");
    await page.getByText(/BEGIN/).click();
    await expect(page.getByText("START RUN")).toBeVisible();

    // Reload — briefing should NOT appear
    await page.reload();
    await expect(page.getByText("START RUN")).toBeVisible();
    await expect(page.getByText("SYSTEM BRIEFING")).not.toBeVisible();
  });

  test("reset onboarding from Codex re-shows briefing", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      store.setState({ onboardingComplete: true, data: 500 });
    });

    // Go to Codex
    await page.getByText("CODEX").click();
    await expect(page.getByText("OPERATION MANUAL")).toBeVisible();

    // Click reset
    await page.getByText(/REPLAY SYSTEM BRIEFING/).click();

    // Go back to menu — briefing should appear
    await page.getByText(/BACK TO MENU/).click();
    await expect(page.getByRole("heading", { name: "SYSTEM BRIEFING" })).toBeVisible();

    // Complete it again
    await page.click("body");
    await page.click("body");
    await page.getByText(/BEGIN/).click();

    // Data should still be 500 (reset didn't touch it)
    const data = await page.evaluate(() => (window as any).__GAME_STORE__.getState().data);
    expect(data).toBe(500);
  });
});
