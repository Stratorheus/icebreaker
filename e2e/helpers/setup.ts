import type { Page } from "@playwright/test";

/**
 * Skip the onboarding briefing by setting the flag directly in the store.
 * Call after page.goto("/") in tests that don't test onboarding itself.
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as any).__GAME_STORE__;
    if (store && !store.getState().onboardingComplete) {
      store.setState({ onboardingComplete: true });
    }
  });
}
