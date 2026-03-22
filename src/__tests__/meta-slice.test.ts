import { describe, it, expect } from "vitest";
import { create } from "zustand";
import { createRunSlice } from "@/store/run-slice";
import { createMetaSlice } from "@/store/meta-slice";
import { createShopSlice } from "@/store/shop-slice";
import type { GameStore } from "@/store/game-store";

// ---------------------------------------------------------------------------
// Test store factory (no persist middleware)
// ---------------------------------------------------------------------------

function createTestStore() {
  return create<GameStore>()((...a) => ({
    ...createRunSlice(...a),
    ...createMetaSlice(...a),
    ...createShopSlice(...a),
  }));
}

// ---------------------------------------------------------------------------
// addData
// ---------------------------------------------------------------------------

describe("addData", () => {
  it("increases data balance", () => {
    const store = createTestStore();
    expect(store.getState().data).toBe(0);
    store.getState().addData(100);
    expect(store.getState().data).toBe(100);
  });

  it("accumulates across multiple calls", () => {
    const store = createTestStore();
    store.getState().addData(50);
    store.getState().addData(75);
    expect(store.getState().data).toBe(125);
  });
});

// ---------------------------------------------------------------------------
// spendData
// ---------------------------------------------------------------------------

describe("spendData", () => {
  it("returns false and does not modify data when balance is insufficient", () => {
    const store = createTestStore();
    store.getState().addData(50);
    const result = store.getState().spendData(100);
    expect(result).toBe(false);
    expect(store.getState().data).toBe(50);
  });

  it("returns true and deducts amount when balance is sufficient", () => {
    const store = createTestStore();
    store.getState().addData(200);
    const result = store.getState().spendData(75);
    expect(result).toBe(true);
    expect(store.getState().data).toBe(125);
  });

  it("returns true when spending exactly the full balance", () => {
    const store = createTestStore();
    store.getState().addData(100);
    const result = store.getState().spendData(100);
    expect(result).toBe(true);
    expect(store.getState().data).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// purchaseUpgrade
// ---------------------------------------------------------------------------

describe("purchaseUpgrade", () => {
  it("sets tier to 1 on first purchase", () => {
    const store = createTestStore();
    store.getState().purchaseUpgrade("speed-tax");
    expect(store.getState().purchasedUpgrades["speed-tax"]).toBe(1);
  });

  it("increments tier on subsequent purchases", () => {
    const store = createTestStore();
    store.getState().purchaseUpgrade("speed-tax");
    store.getState().purchaseUpgrade("speed-tax");
    expect(store.getState().purchasedUpgrades["speed-tax"]).toBe(2);
  });

  it("does NOT deduct data (purchaseUpgrade is the raw setter; cost is handled by UI)", () => {
    const store = createTestStore();
    store.getState().addData(500);
    store.getState().purchaseUpgrade("cascade-clock");
    // purchaseUpgrade itself doesn't spend data — the shop UI calls spendData separately
    expect(store.getState().data).toBe(500);
  });

  it("tracks multiple distinct upgrades independently", () => {
    const store = createTestStore();
    store.getState().purchaseUpgrade("speed-tax");
    store.getState().purchaseUpgrade("speed-tax");
    store.getState().purchaseUpgrade("cascade-clock");
    expect(store.getState().purchasedUpgrades["speed-tax"]).toBe(2);
    expect(store.getState().purchasedUpgrades["cascade-clock"]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// unlockMinigame
// ---------------------------------------------------------------------------

describe("unlockMinigame", () => {
  it("adds a new minigame to unlockedMinigames", () => {
    const store = createTestStore();
    const before = store.getState().unlockedMinigames.length;
    store.getState().unlockMinigame("defrag");
    expect(store.getState().unlockedMinigames).toContain("defrag");
    expect(store.getState().unlockedMinigames.length).toBe(before + 1);
  });

  it("does not add duplicates if minigame is already unlocked", () => {
    const store = createTestStore();
    store.getState().unlockMinigame("defrag");
    const after1 = store.getState().unlockedMinigames.length;
    store.getState().unlockMinigame("defrag");
    expect(store.getState().unlockedMinigames.length).toBe(after1);
  });
});

// ---------------------------------------------------------------------------
// recordMinigameResult
// ---------------------------------------------------------------------------

describe("recordMinigameResult", () => {
  it("increments win streak and total on win", () => {
    const store = createTestStore();
    store.getState().recordMinigameResult("slash-timing", true);
    expect(store.getState().stats.minigameWinStreaks["slash-timing"]).toBe(1);
    expect(store.getState().stats.minigameWinsTotal["slash-timing"]).toBe(1);
  });

  it("accumulates streak across consecutive wins", () => {
    const store = createTestStore();
    store.getState().recordMinigameResult("slash-timing", true);
    store.getState().recordMinigameResult("slash-timing", true);
    store.getState().recordMinigameResult("slash-timing", true);
    expect(store.getState().stats.minigameWinStreaks["slash-timing"]).toBe(3);
    expect(store.getState().stats.minigameWinsTotal["slash-timing"]).toBe(3);
  });

  it("resets win streak to 0 on loss but does not decrement total", () => {
    const store = createTestStore();
    store.getState().recordMinigameResult("slash-timing", true);
    store.getState().recordMinigameResult("slash-timing", true);
    store.getState().recordMinigameResult("slash-timing", false);
    expect(store.getState().stats.minigameWinStreaks["slash-timing"]).toBe(0);
    expect(store.getState().stats.minigameWinsTotal["slash-timing"]).toBe(2);
  });

  it("does not increment total on loss", () => {
    const store = createTestStore();
    store.getState().recordMinigameResult("slash-timing", false);
    expect(store.getState().stats.minigameWinsTotal["slash-timing"]).toBe(0);
  });

  it("tracks different minigames independently", () => {
    const store = createTestStore();
    store.getState().recordMinigameResult("slash-timing", true);
    store.getState().recordMinigameResult("close-brackets", true);
    store.getState().recordMinigameResult("close-brackets", true);
    expect(store.getState().stats.minigameWinStreaks["slash-timing"]).toBe(1);
    expect(store.getState().stats.minigameWinStreaks["close-brackets"]).toBe(2);
  });
});
