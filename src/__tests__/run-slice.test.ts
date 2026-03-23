import { describe, it, expect } from "vitest";
import { createTestStore } from "./helpers/test-store";
import { getStartingCredits, getEffectiveDamage } from "@/data/balancing";
import type { PowerUpInstance } from "@/types/game";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePowerUp(
  type: string,
  effectType: PowerUpInstance["effect"]["type"],
  value: number,
  remainingUses?: number,
): PowerUpInstance {
  return {
    id: `${type}-${Math.random()}`,
    type,
    name: type,
    description: "",
    effect: { type: effectType, value },
    ...(remainingUses !== undefined ? { remainingUses } : {}),
  };
}

// ---------------------------------------------------------------------------
// startRun
// ---------------------------------------------------------------------------

describe("startRun — base state reset", () => {
  it("sets status to 'playing'", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().status).toBe("playing");
  });

  it("resets floor to 1", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().floor).toBe(1);
  });

  it("resets credits to 25 (base, no head-start)", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().credits).toBe(getStartingCredits(0));
  });

  it("resets inventory to empty", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().inventory).toHaveLength(0);
  });

  it("resets quitVoluntarily to false", () => {
    const store = createTestStore();
    store.setState({ quitVoluntarily: true });
    store.getState().startRun();
    expect(store.getState().quitVoluntarily).toBe(false);
  });

  it("resets dataDripThisRun to 0", () => {
    const store = createTestStore();
    store.setState({ dataDripThisRun: 99 });
    store.getState().startRun();
    expect(store.getState().dataDripThisRun).toBe(0);
  });

  it("resets timeSiphonBonus to 0", () => {
    const store = createTestStore();
    store.setState({ timeSiphonBonus: 5 });
    store.getState().startRun();
    expect(store.getState().timeSiphonBonus).toBe(0);
  });

  it("resets cascadeClockPct to 0", () => {
    const store = createTestStore();
    store.setState({ cascadeClockPct: 0.5 });
    store.getState().startRun();
    expect(store.getState().cascadeClockPct).toBe(0);
  });

  it("snapshots dataAtRunStart from current meta data balance", () => {
    const store = createTestStore();
    store.getState().addData(500);
    store.getState().startRun();
    expect(store.getState().dataAtRunStart).toBe(500);
  });

  it("picks at least 1 minigame for floor 1", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().floorMinigames.length).toBeGreaterThan(0);
  });
});

describe("startRun — head-start upgrade applies bonus credits", () => {
  it("applies tier-1 head-start (+50 CR)", () => {
    const store = createTestStore();
    store.setState({ purchasedUpgrades: { "head-start": 1 } });
    store.getState().startRun();
    expect(store.getState().credits).toBe(getStartingCredits(1)); // 25 + 50 = 75
  });

  it("applies tier-3 head-start (+300 CR)", () => {
    const store = createTestStore();
    store.setState({ purchasedUpgrades: { "head-start": 3 } });
    store.getState().startRun();
    expect(store.getState().credits).toBe(getStartingCredits(3)); // 25 + 300 = 325
  });
});

describe("startRun — overclocked upgrade applies HP bonus", () => {
  it("tier 1 overclocked gives +5 max HP", () => {
    const store = createTestStore();
    store.setState({ purchasedUpgrades: { overclocked: 1 } });
    store.getState().startRun();
    // base 100 + overclocked 5 = 105
    expect(store.getState().maxHp).toBe(105);
    expect(store.getState().hp).toBe(105);
  });

  it("tier 3 overclocked gives +15 max HP", () => {
    const store = createTestStore();
    store.setState({ purchasedUpgrades: { overclocked: 3 } });
    store.getState().startRun();
    expect(store.getState().maxHp).toBe(115);
  });
});

describe("startRun — hp-boost (stackable) applies max HP", () => {
  it("tier 2 hp-boost gives +10 max HP", () => {
    const store = createTestStore();
    store.setState({ purchasedUpgrades: { "hp-boost": 2 } });
    store.getState().startRun();
    expect(store.getState().maxHp).toBe(110);
  });
});

// ---------------------------------------------------------------------------
// completeMinigame
// ---------------------------------------------------------------------------

describe("completeMinigame — credits and scoring", () => {
  it("awards credits and adds to runScore", () => {
    const store = createTestStore();
    store.getState().startRun();
    const creditsBefore = store.getState().credits;
    const scoreBefore = store.getState().runScore;

    store.getState().completeMinigame({
      success: true,
      timeMs: 5000,
      minigame: "slash-timing",
    });

    expect(store.getState().credits).toBeGreaterThan(creditsBefore);
    expect(store.getState().runScore).toBeGreaterThan(scoreBefore);
  });

  it("tracks creditsEarnedThisRun (excludes Head Start)", () => {
    const store = createTestStore();
    // Give Head Start tier 3 (+300 CR)
    store.setState({ purchasedUpgrades: { "head-start": 3 } });
    store.getState().startRun();

    // Starting credits include Head Start, but creditsEarnedThisRun starts at 0
    expect(store.getState().credits).toBeGreaterThan(25); // has head start bonus
    expect(store.getState().creditsEarnedThisRun).toBe(0);

    // Win a minigame
    store.getState().completeMinigame({
      success: true,
      timeMs: 5000,
      minigame: "slash-timing",
    });

    const earned = store.getState().creditsEarnedThisRun;
    expect(earned).toBeGreaterThan(0);
    // credits = starting + earned, but creditsEarnedThisRun only tracks earned
    expect(store.getState().credits).toBeGreaterThan(earned);
  });

  it("accumulates dataDripThisRun on each win", () => {
    const store = createTestStore();
    store.getState().startRun();

    store.getState().completeMinigame({
      success: true,
      timeMs: 5000,
      minigame: "slash-timing",
    });
    const after1 = store.getState().dataDripThisRun;
    expect(after1).toBeGreaterThan(0);

    // Manually re-set so there's more to play (not last minigame)
    store.setState({ floorMinigames: ["slash-timing", "slash-timing", "slash-timing"], currentMinigameIndex: 1 });
    store.getState().completeMinigame({
      success: true,
      timeMs: 5000,
      minigame: "slash-timing",
    });
    expect(store.getState().dataDripThisRun).toBeGreaterThan(after1);
  });

  it("increments minigamesWonThisRun", () => {
    const store = createTestStore();
    store.getState().startRun();
    const before = store.getState().minigamesWonThisRun;
    store.getState().completeMinigame({
      success: true,
      timeMs: 5000,
      minigame: "slash-timing",
    });
    expect(store.getState().minigamesWonThisRun).toBe(before + 1);
  });

  it("applies partial rewards when rewardFraction < 1", () => {
    const store = createTestStore();
    store.getState().startRun();
    const creditsBefore = store.getState().credits;

    // Two calls: one full, one fractional — fractional should earn fewer
    const fullStore = createTestStore();
    fullStore.getState().startRun();
    const fullCreditsBefore = fullStore.getState().credits;

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing", rewardFraction: 0.5 });
    fullStore.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing", rewardFraction: 1 });

    const fractionalEarned = store.getState().credits - creditsBefore;
    const fullEarned = fullStore.getState().credits - fullCreditsBefore;
    expect(fractionalEarned).toBeLessThan(fullEarned);
  });

  it("applies heal-on-success power-up", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ hp: 80, maxHp: 100 });
    store.setState({
      inventory: [makePowerUp("nano-repair", "heal-on-success", 10)],
    });

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().hp).toBeGreaterThan(80);
  });

  it("increments timeSiphonBonus when time-siphon power-up in inventory", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({
      inventory: [makePowerUp("time-siphon", "time-siphon", 0.2)],
    });
    const before = store.getState().timeSiphonBonus;

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().timeSiphonBonus).toBeCloseTo(before + 0.2);
  });

  it("advances to next minigame index when not last in floor", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({
      floorMinigames: ["slash-timing", "close-brackets", "match-arrows"],
      currentMinigameIndex: 0,
    });

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().currentMinigameIndex).toBe(1);
  });

  it("triggers shop status when last minigame on non-milestone floor", () => {
    const store = createTestStore();
    store.getState().startRun();
    // Floor 1 is not a milestone floor (not divisible by 5)
    store.setState({
      floorMinigames: ["slash-timing"],
      currentMinigameIndex: 0,
      floor: 1,
    });

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().status).toBe("shop");
  });

  it("triggers milestone status when last minigame on milestone floor (floor 5)", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({
      floorMinigames: ["slash-timing"],
      currentMinigameIndex: 0,
      floor: 5,
      stats: {
        totalRuns: 0,
        bestFloor: 0,
        totalMinigamesPlayed: 0,
        totalMinigamesWon: 0,
        totalCreditsEarned: 0,
        totalDataEarned: 0,
        totalPlayTimeMs: 0,
        minigameWinStreaks: {},
        minigameWinsTotal: {},
      },
    });

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().status).toBe("milestone");
    expect(store.getState().milestoneFloor).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// failMinigame
// ---------------------------------------------------------------------------

describe("failMinigame — damage application", () => {
  it("reduces HP by effective damage (floor 1, no armor)", () => {
    const store = createTestStore();
    store.getState().startRun();
    const expectedDamage = getEffectiveDamage(1, 0); // 24
    const hpBefore = store.getState().hp;

    store.getState().failMinigame();
    expect(store.getState().hp).toBe(hpBefore - expectedDamage);
  });

  it("reduces HP less with thicker-armor tier 1 (5% reduction)", () => {
    const noArmorStore = createTestStore();
    noArmorStore.getState().startRun();

    const armorStore = createTestStore();
    armorStore.getState().startRun();
    armorStore.setState({ purchasedUpgrades: { "thicker-armor": 1 } });

    const hpBefore = noArmorStore.getState().hp;
    noArmorStore.getState().failMinigame();
    armorStore.getState().failMinigame();

    const noArmorDamage = hpBefore - noArmorStore.getState().hp;
    const armorDamage = hpBefore - armorStore.getState().hp;
    expect(armorDamage).toBeLessThan(noArmorDamage);
  });

  it("resets timeSiphonBonus to 0 on fail", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ timeSiphonBonus: 2.0, hp: 200, maxHp: 200 });

    store.getState().failMinigame();
    expect(store.getState().timeSiphonBonus).toBe(0);
  });

  it("resets cascadeClockPct to 0 on fail", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ cascadeClockPct: 0.3, hp: 200, maxHp: 200 });

    store.getState().failMinigame();
    expect(store.getState().cascadeClockPct).toBe(0);
  });

  it("sets status to 'dead' if HP reaches 0", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ hp: 1, maxHp: 100 }); // damage (24 on floor 1) will kill

    store.getState().failMinigame();
    expect(store.getState().hp).toBe(0);
    expect(store.getState().status).toBe("dead");
  });

  it("does NOT set status to 'dead' if HP survives the damage", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ hp: 200, maxHp: 200, floor: 1 });

    store.getState().failMinigame();
    expect(store.getState().status).not.toBe("dead");
  });

  it("re-rolls current minigame slot on survive", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({
      hp: 200,
      maxHp: 200,
      floorMinigames: ["slash-timing", "close-brackets"],
      currentMinigameIndex: 0,
      unlockedMinigames: ["slash-timing", "close-brackets", "match-arrows"],
    });
    const original = store.getState().floorMinigames[0];

    store.getState().failMinigame();
    // The re-rolled game must be different from the original when pool is large enough
    const rerolled = store.getState().floorMinigames[0];
    // Re-rolled should differ from original (with alternatives available)
    expect(rerolled).not.toBe(original);
  });

  it("increments minigamesPlayedThisRun on fail", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ hp: 200, maxHp: 200 });
    const before = store.getState().minigamesPlayedThisRun;

    store.getState().failMinigame();
    expect(store.getState().minigamesPlayedThisRun).toBe(before + 1);
  });

  it("full-shield power-up negates all damage", () => {
    const store = createTestStore();
    store.getState().startRun();
    const shield = makePowerUp("firewall-patch", "shield", 1);
    store.setState({ hp: 100, maxHp: 100, inventory: [shield] });

    store.getState().failMinigame();
    expect(store.getState().hp).toBe(100);
    // Shield should be consumed
    expect(store.getState().inventory.find((p) => p.effect.type === "shield")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// quitRun
// ---------------------------------------------------------------------------

describe("quitRun", () => {
  it("sets quitVoluntarily to true", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.getState().quitRun();
    expect(store.getState().quitVoluntarily).toBe(true);
  });

  it("sets status to 'dead'", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.getState().quitRun();
    expect(store.getState().status).toBe("dead");
  });
});

// ---------------------------------------------------------------------------
// consecutiveFloorsNoDamage
// ---------------------------------------------------------------------------

describe("consecutiveFloorsNoDamage", () => {
  it("starts at 0 on new run", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().consecutiveFloorsNoDamage).toBe(0);
  });

  it("increments on completeMinigame when last minigame and no damage taken", () => {
    const store = createTestStore();
    store.getState().startRun();
    // Set up a single-minigame floor so completeMinigame triggers floor completion
    store.setState({
      floorMinigames: ["slash-timing"],
      currentMinigameIndex: 0,
      floor: 1,
      floorDamageTaken: false,
    });

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().consecutiveFloorsNoDamage).toBe(1);
  });

  it("accumulates across multiple floor completions without damage", () => {
    const store = createTestStore();
    store.getState().startRun();

    // Complete floor 1 (no damage)
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0, floor: 1, floorDamageTaken: false });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().consecutiveFloorsNoDamage).toBe(1);

    // Advance and complete floor 2 (no damage)
    store.getState().advanceFloor();
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0, floorDamageTaken: false });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().consecutiveFloorsNoDamage).toBe(2);
  });

  it("resets to 0 on completeMinigame when last minigame and damage was taken on floor", () => {
    const store = createTestStore();
    store.getState().startRun();

    // Complete floor 1 clean
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0, floor: 1, floorDamageTaken: false });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().consecutiveFloorsNoDamage).toBe(1);

    // Advance then take damage on floor 2
    store.getState().advanceFloor();
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0, floorDamageTaken: true });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().consecutiveFloorsNoDamage).toBe(0);
  });

  it("resets to 0 on failMinigame when damage is taken", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ hp: 200, maxHp: 200, consecutiveFloorsNoDamage: 3 });

    store.getState().failMinigame();
    expect(store.getState().consecutiveFloorsNoDamage).toBe(0);
  });

  it("does NOT reset on failMinigame when shield absorbs all damage", () => {
    const store = createTestStore();
    store.getState().startRun();
    const shield = makePowerUp("firewall-patch", "shield", 1);
    store.setState({ hp: 100, maxHp: 100, inventory: [shield], consecutiveFloorsNoDamage: 3 });

    store.getState().failMinigame();
    // Shield absorbed all damage, so consecutiveFloorsNoDamage should NOT reset
    expect(store.getState().consecutiveFloorsNoDamage).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// floorCompletionTimestamps
// ---------------------------------------------------------------------------

describe("floorCompletionTimestamps", () => {
  it("starts with one marker timestamp on new run", () => {
    const store = createTestStore();
    store.getState().startRun();
    // Floor-0 marker is pushed at startRun
    expect(store.getState().floorCompletionTimestamps).toHaveLength(1);
  });

  it("accumulates timestamps on floor completion (completeMinigame last)", () => {
    const store = createTestStore();
    store.getState().startRun();

    // Complete floor 1 (single minigame)
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0, floor: 1 });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().floorCompletionTimestamps).toHaveLength(2);

    // Advance and complete floor 2
    store.getState().advanceFloor();
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0 });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().floorCompletionTimestamps).toHaveLength(3);

    // Timestamps should be increasing
    const ts = store.getState().floorCompletionTimestamps;
    expect(ts[2]).toBeGreaterThanOrEqual(ts[1]);
    expect(ts[1]).toBeGreaterThanOrEqual(ts[0]);
  });
});

// ---------------------------------------------------------------------------
// creditsSpentThisShop
// ---------------------------------------------------------------------------

describe("creditsSpentThisShop", () => {
  it("starts at 0 on new run", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().creditsSpentThisShop).toBe(0);
  });

  it("resets to 0 on advanceFloor", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ creditsSpentThisShop: 500 });

    store.getState().advanceFloor();
    expect(store.getState().creditsSpentThisShop).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// consecutiveFloorsNoShop
// ---------------------------------------------------------------------------

describe("consecutiveFloorsNoShop", () => {
  it("starts at 0 on new run", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().consecutiveFloorsNoShop).toBe(0);
  });

  it("increments on completeMinigame (last) when no credits spent", () => {
    const store = createTestStore();
    store.getState().startRun();

    // Complete floor with no shop spending
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0, floor: 1, creditsSpentThisShop: 0 });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().consecutiveFloorsNoShop).toBe(1);

    // Advance and complete another floor without spending
    store.getState().advanceFloor();
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0, creditsSpentThisShop: 0 });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().consecutiveFloorsNoShop).toBe(2);
  });

  it("resets to 0 on completeMinigame (last) when credits were spent", () => {
    const store = createTestStore();
    store.getState().startRun();

    // Complete floor 1 without spending
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0, floor: 1, creditsSpentThisShop: 0 });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().consecutiveFloorsNoShop).toBe(1);

    // Advance, simulate buying, complete floor 2
    store.getState().advanceFloor();
    store.setState({ floorMinigames: ["slash-timing"], currentMinigameIndex: 0, creditsSpentThisShop: 100 });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().consecutiveFloorsNoShop).toBe(0);
  });

  it("resets creditsSpentThisShop to 0 on advanceFloor", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ creditsSpentThisShop: 500 });

    store.getState().advanceFloor();
    expect(store.getState().creditsSpentThisShop).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// lastDamageTaken
// ---------------------------------------------------------------------------

describe("lastDamageTaken", () => {
  it("starts at 0 on new run", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().lastDamageTaken).toBe(0);
  });

  it("is set to actual damage on failMinigame (survive)", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ hp: 200, maxHp: 200 });

    store.getState().failMinigame();
    expect(store.getState().lastDamageTaken).toBeGreaterThan(0);
  });

  it("is set to damage on failMinigame (death)", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ hp: 1, maxHp: 100 });

    store.getState().failMinigame();
    expect(store.getState().lastDamageTaken).toBeGreaterThan(0);
  });

  it("is 0 when shield absorbs all damage", () => {
    const store = createTestStore();
    store.getState().startRun();
    const shield = makePowerUp("firewall-patch", "shield", 1);
    store.setState({ hp: 100, maxHp: 100, inventory: [shield] });

    store.getState().failMinigame();
    expect(store.getState().lastDamageTaken).toBe(0);
  });

  it("resets to 0 on completeMinigame", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ lastDamageTaken: 20 });

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().lastDamageTaken).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// currentWinStreak
// ---------------------------------------------------------------------------

describe("currentWinStreak", () => {
  it("starts at 0 on new run", () => {
    const store = createTestStore();
    store.getState().startRun();
    expect(store.getState().currentWinStreak).toBe(0);
  });

  it("increments on completeMinigame", () => {
    const store = createTestStore();
    store.getState().startRun();

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().currentWinStreak).toBe(1);
  });

  it("accumulates on consecutive wins", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({
      floorMinigames: ["slash-timing", "slash-timing", "slash-timing"],
      currentMinigameIndex: 0,
    });

    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    store.getState().completeMinigame({ success: true, timeMs: 5000, minigame: "slash-timing" });
    expect(store.getState().currentWinStreak).toBe(2);
  });

  it("resets to 0 on failMinigame", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ hp: 200, maxHp: 200, currentWinStreak: 5 });

    store.getState().failMinigame();
    expect(store.getState().currentWinStreak).toBe(0);
  });

  it("resets to 0 on failMinigame (death)", () => {
    const store = createTestStore();
    store.getState().startRun();
    store.setState({ hp: 1, maxHp: 100, currentWinStreak: 5 });

    store.getState().failMinigame();
    expect(store.getState().currentWinStreak).toBe(0);
  });
});
