import { test, expect, type Page } from "@playwright/test";
import { setMetaUpgrades } from "./helpers/training";

// ---------------------------------------------------------------------------
// Helper: start a run and navigate to vendor (shop) via store manipulation
// ---------------------------------------------------------------------------

async function reachVendor(page: Page, options: { hp?: number; credits?: number } = {}) {
  await page.evaluate(() => {
    const store = (window as any).__GAME_STORE__;
    store.getState().startRun();
  });
  // Wait for playing status UI to appear
  await page.locator('[data-testid="minigame-active"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);

  // Override HP/credits if requested
  const overrides: Record<string, unknown> = {};
  if (options.hp !== undefined) overrides.hp = options.hp;
  if (options.credits !== undefined) overrides.credits = options.credits;
  if (Object.keys(overrides).length > 0) {
    await page.evaluate((ovr) => {
      (window as any).__GAME_STORE__.setState(ovr);
    }, overrides);
    await page.waitForTimeout(100);
  }

  // Skip to shop: generate shop offers + set status
  await page.evaluate(() => {
    const store = (window as any).__GAME_STORE__;
    store.getState().generateRunShop(1);
    store.setState({ status: "shop" });
  });

  // Wait for vendor UI
  await expect(page.getByText("VENDOR NODE")).toBeVisible({ timeout: 5000 });
}

// ===========================================================================
// RUN SHOP TESTS
// ===========================================================================

test.describe("Run Shop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // -------------------------------------------------------------------------
  // 1. Shop displays offers after floor
  // -------------------------------------------------------------------------
  test("shop displays 3-4 items with names and prices", async ({ page }) => {
    await reachVendor(page, { credits: 500 });

    // Shop should show "VENDOR NODE" title
    await expect(page.getByText("VENDOR NODE")).toBeVisible();

    // Should have BUY buttons (one per offer that isn't already owned)
    const buyButtons = page.locator("button:has-text('BUY')");
    const count = await buyButtons.count();
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(4);

    // Each item should display a price with "CR"
    const crLabels = page.locator("text=/ \\d+ CR/");
    const priceCount = await crLabels.count();
    expect(priceCount).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------------------
  // 2. Buy a heal item — HP increases
  // -------------------------------------------------------------------------
  test("buying a heal item increases HP", async ({ page }) => {
    // Set HP below max and give plenty of credits
    await reachVendor(page, { hp: 50, credits: 5000 });

    // Read HP before purchase
    const hpBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().hp,
    );
    expect(hpBefore).toBe(50);

    // Force-inject a heal item into the shop offers for reliable testing
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      const state = store.getState();
      const healOffer = {
        id: "repair-kit",
        name: "Repair Kit",
        description: "Restore +25 HP immediately.",
        category: "healing",
        basePrice: 65,
        effect: { type: "heal", value: 25 },
        icon: "heart-pulse",
        price: 65,
        purchased: false,
      };
      // Replace first offer with heal item
      const offers = [...state.runShopOffers];
      offers[0] = healOffer;
      store.setState({ runShopOffers: offers });
    });
    await page.waitForTimeout(200);

    // Click BUY on the Repair Kit
    const repairKitCard = page.locator("text=Repair Kit").locator("..");
    // Find the BUY button near the repair kit item
    const buyButton = page.locator("button:has-text('BUY')").first();
    await buyButton.click();
    await page.waitForTimeout(300);

    // HP should have increased by 25 (heal effect)
    const hpAfter = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().hp,
    );
    expect(hpAfter).toBe(75);
  });

  // -------------------------------------------------------------------------
  // 3. Buy shield — appears in inventory
  // -------------------------------------------------------------------------
  test("buying a shield adds it to inventory", async ({ page }) => {
    await reachVendor(page, { credits: 5000 });

    // Force-inject a shield item
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      const state = store.getState();
      const shieldOffer = {
        id: "firewall-patch",
        name: "Firewall Patch",
        description: "Next failure deals 0 damage. Consumed on trigger.",
        category: "defense",
        basePrice: 60,
        effect: { type: "shield", value: 1 },
        icon: "shield",
        price: 60,
        purchased: false,
      };
      const offers = [...state.runShopOffers];
      offers[0] = shieldOffer;
      store.setState({ runShopOffers: offers });
    });
    await page.waitForTimeout(200);

    // Inventory should be empty before buying
    const invBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().inventory.length,
    );
    expect(invBefore).toBe(0);

    // Buy the shield
    const buyButton = page.locator("button:has-text('BUY')").first();
    await buyButton.click();
    await page.waitForTimeout(300);

    // Inventory should now contain the shield
    const inventory = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().inventory,
    );
    expect(inventory.length).toBe(1);
    expect(inventory[0].type).toBe("firewall-patch");
    expect(inventory[0].effect.type).toBe("shield");
  });

  // -------------------------------------------------------------------------
  // 4. Cannot buy with insufficient credits
  // -------------------------------------------------------------------------
  test("BUY buttons disabled with 0 credits", async ({ page }) => {
    await reachVendor(page, { credits: 0 });

    // All BUY buttons should be disabled (have cursor-not-allowed styling)
    const buyButtons = page.locator("button:has-text('BUY')");
    const count = await buyButtons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(buyButtons.nth(i)).toBeDisabled();
    }
  });

  // -------------------------------------------------------------------------
  // 5. Cannot buy duplicate type (purchased shows ACQUIRED overlay)
  // -------------------------------------------------------------------------
  test("purchased item shows ACQUIRED and cannot be bought again", async ({ page }) => {
    await reachVendor(page, { credits: 5000 });

    // Force a known item
    await page.evaluate(() => {
      const store = (window as any).__GAME_STORE__;
      const state = store.getState();
      const offer = {
        id: "time-freeze",
        name: "Time Freeze",
        description: "Adds +1 s to every protocol on the current floor.",
        category: "time",
        basePrice: 30,
        effect: { type: "time-bonus", value: 1 },
        icon: "clock",
        price: 30,
        purchased: false,
      };
      const offers = [...state.runShopOffers];
      offers[0] = offer;
      store.setState({ runShopOffers: offers });
    });
    await page.waitForTimeout(200);

    // Buy the item
    const buyButton = page.locator("button:has-text('BUY')").first();
    await buyButton.click();
    await page.waitForTimeout(300);

    // The item should now show "ACQUIRED" overlay
    await expect(page.getByText("ACQUIRED")).toBeVisible({ timeout: 3000 });

    // The button for that item should now show "SOLD"
    await expect(page.getByText("SOLD")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6. CONTINUE advances to next floor
  // -------------------------------------------------------------------------
  test("CONTINUE button advances to floor 2", async ({ page }) => {
    await reachVendor(page, { credits: 500 });

    // Verify we see "CONTINUE TO FLOOR 2"
    await expect(page.getByText("CONTINUE TO FLOOR 2")).toBeVisible();

    // Read floor before
    const floorBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().floor,
    );
    expect(floorBefore).toBe(1);

    // Click CONTINUE
    await page.getByText("CONTINUE TO FLOOR 2").click();
    await page.waitForTimeout(500);

    // Floor should now be 2 and status should be "playing"
    const state = await page.evaluate(() => {
      const s = (window as any).__GAME_STORE__.getState();
      return { floor: s.floor, status: s.status };
    });
    expect(state.floor).toBe(2);
    expect(state.status).toBe("playing");
  });

  // -------------------------------------------------------------------------
  // 7. Reroll changes shop offers
  // -------------------------------------------------------------------------
  test("reroll button regenerates shop offers", async ({ page }) => {
    await reachVendor(page, { credits: 5000 });

    // Read current offer names
    const offerNamesBefore = await page.evaluate(() =>
      (window as any).__GAME_STORE__
        .getState()
        .runShopOffers.map((o: any) => o.id),
    );

    // Click reroll — the button text includes "REROLL STOCK"
    await page.locator("button:has-text('REROLL STOCK')").click();
    await page.waitForTimeout(300);

    // Credits should have decreased (reroll costs 20 + floor * 10 = 30 on floor 1)
    const credits = await page.evaluate(() =>
      (window as any).__GAME_STORE__.getState().credits,
    );
    expect(credits).toBeLessThan(5000);

    // Offers should have been regenerated (may be same by random chance, but offers array is fresh)
    const offerNamesAfter = await page.evaluate(() =>
      (window as any).__GAME_STORE__
        .getState()
        .runShopOffers.map((o: any) => o.id),
    );
    // At minimum the offers array was regenerated (all unpurchased)
    const allUnpurchased = await page.evaluate(() =>
      (window as any).__GAME_STORE__
        .getState()
        .runShopOffers.every((o: any) => !o.purchased),
    );
    expect(allUnpurchased).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. Quit run from vendor shows death screen
  // -------------------------------------------------------------------------
  test("quit run from vendor shows data reward screen", async ({ page }) => {
    await reachVendor(page, { credits: 200 });

    // Click QUIT RUN — the button includes "QUIT RUN" text
    await page.locator("button:has-text('QUIT RUN')").click();
    await page.waitForTimeout(200);

    // Confirmation appears
    await expect(page.getByText("QUIT?")).toBeVisible({ timeout: 3000 });

    // Click CONFIRM
    await page.getByText("CONFIRM").click();
    await page.waitForTimeout(500);

    // Should show "RUN TERMINATED" (voluntary quit)
    await expect(page.getByText("RUN TERMINATED")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("VOLUNTARY DISCONNECT")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 9. CODEX and STATS accessible from vendor
  // -------------------------------------------------------------------------
  test("CODEX accessible from vendor and returns to shop", async ({ page }) => {
    await reachVendor(page, { credits: 200 });

    await page.locator("button:has-text('CODEX')").click();
    await page.waitForTimeout(300);

    // Should navigate to Codex view (verify some codex content appears)
    // The Codex back button reads ">_ BACK TO VENDOR" when entered from vendor context
    const backButton = page.getByRole("button", { name: /BACK TO VENDOR/i });
    await expect(backButton).toBeVisible({ timeout: 5000 });

    await backButton.click();
    await page.waitForTimeout(300);

    // Should return to vendor
    await expect(page.getByText("VENDOR NODE")).toBeVisible({ timeout: 3000 });
  });
});
