import { describe, it, expect } from "vitest";
import {
  checkAchievements,
  checkNearMisses,
  type AchievementCheckContext,
} from "@/lib/achievement-checker";
import type { PlayerStats } from "@/types/game";

// ---------------------------------------------------------------------------
// Helper — default context with all fields zeroed/empty
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    totalRuns: 0,
    bestFloor: 0,
    totalMinigamesPlayed: 0,
    totalMinigamesWon: 0,
    totalCreditsEarned: 0,
    totalDataEarned: 0,
    totalPlayTimeMs: 0,
    minigameWinStreaks: {},
    minigameWinsTotal: {},
    ...overrides,
  };
}

function makeCtx(overrides: Partial<AchievementCheckContext> = {}): AchievementCheckContext {
  return {
    floor: 1,
    floorDamageTaken: false,
    runDamageTaken: false,
    powerUpsUsedThisFloor: false,
    inventorySize: 0,
    hp: 100,
    maxHp: 100,
    runStartTime: Date.now(),
    earnedAchievements: [],
    stats: makeStats(),
    consecutiveFloorsNoDamage: 0,
    floorCompletionTimestamps: [],
    lastMinigame: undefined,
    creditsSpentThisShop: 0,
    consecutiveFloorsNoShop: 0,
    lastDamageTaken: 0,
    currentWinStreak: 0,
    unlockedMinigamesCount: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. evaluateCondition — new condition types
// ---------------------------------------------------------------------------

// evaluateCondition is not exported, so we test it indirectly via
// checkAchievements with real achievements from the pool that use each type.
//
// We use known achievement IDs from the pool:
//   shop-spending         → "bargain-hunter"  (amount: 200)
//   total-data-earned     → "data-miner"      (amount: 1000)
//   survive-low-hp        → "one-hp"          (maxHp: 5)
//   survive-low-hp-pct    → "clutch"          (maxPct: 0.10)
//   consecutive-floors-no-shop → "ascetic"   (count: 3)
//   all-minigames-unlocked → "collector"      (no params)
//   total-minigames-won   → "first-blood"     (count: 1)
//   minigame-win-streak   → "streak-master"   (count: 15)

// Helper to check whether a specific achievement is in the returned list
function hasAchievement(achievements: { id: string }[], id: string): boolean {
  return achievements.some((a) => a.id === id);
}

describe("evaluateCondition — shop-spending", () => {
  // bargain-hunter: creditsSpentThisShop >= 200
  it("passes when spent exactly at threshold", () => {
    const result = checkAchievements(makeCtx({ creditsSpentThisShop: 200 }));
    expect(hasAchievement(result, "bargain-hunter")).toBe(true);
  });

  it("passes when spent above threshold", () => {
    const result = checkAchievements(makeCtx({ creditsSpentThisShop: 350 }));
    expect(hasAchievement(result, "bargain-hunter")).toBe(true);
  });

  it("fails when one below threshold", () => {
    const result = checkAchievements(makeCtx({ creditsSpentThisShop: 199 }));
    expect(hasAchievement(result, "bargain-hunter")).toBe(false);
  });

  it("fails when zero", () => {
    const result = checkAchievements(makeCtx({ creditsSpentThisShop: 0 }));
    expect(hasAchievement(result, "bargain-hunter")).toBe(false);
  });
});

describe("evaluateCondition — total-data-earned", () => {
  // data-miner: totalDataEarned >= 1000
  it("passes when earned exactly at threshold", () => {
    const result = checkAchievements(makeCtx({ stats: makeStats({ totalDataEarned: 1000 }) }));
    expect(hasAchievement(result, "data-miner")).toBe(true);
  });

  it("passes when earned above threshold", () => {
    const result = checkAchievements(makeCtx({ stats: makeStats({ totalDataEarned: 5000 }) }));
    expect(hasAchievement(result, "data-miner")).toBe(true);
  });

  it("fails when one below threshold", () => {
    const result = checkAchievements(makeCtx({ stats: makeStats({ totalDataEarned: 999 }) }));
    expect(hasAchievement(result, "data-miner")).toBe(false);
  });

  it("fails when zero", () => {
    const result = checkAchievements(makeCtx({ stats: makeStats({ totalDataEarned: 0 }) }));
    expect(hasAchievement(result, "data-miner")).toBe(false);
  });
});

describe("evaluateCondition — survive-low-hp", () => {
  // one-hp: lastDamageTaken > 0 && hp > 0 && hp <= 5
  it("passes at exactly maxHp threshold with damage taken", () => {
    const result = checkAchievements(makeCtx({ hp: 5, maxHp: 100, lastDamageTaken: 10 }));
    expect(hasAchievement(result, "one-hp")).toBe(true);
  });

  it("passes when hp is 1 (edge case minimum)", () => {
    const result = checkAchievements(makeCtx({ hp: 1, maxHp: 100, lastDamageTaken: 10 }));
    expect(hasAchievement(result, "one-hp")).toBe(true);
  });

  it("fails when hp is one above threshold", () => {
    const result = checkAchievements(makeCtx({ hp: 6, maxHp: 100, lastDamageTaken: 10 }));
    expect(hasAchievement(result, "one-hp")).toBe(false);
  });

  it("fails when no damage was taken (lastDamageTaken = 0)", () => {
    const result = checkAchievements(makeCtx({ hp: 3, maxHp: 100, lastDamageTaken: 0 }));
    expect(hasAchievement(result, "one-hp")).toBe(false);
  });

  it("fails when hp is 0 (player is dead)", () => {
    const result = checkAchievements(makeCtx({ hp: 0, maxHp: 100, lastDamageTaken: 10 }));
    expect(hasAchievement(result, "one-hp")).toBe(false);
  });
});

describe("evaluateCondition — survive-low-hp-pct", () => {
  // clutch: lastDamageTaken > 0 && hp > 0 && (hp / maxHp) <= 0.10
  it("passes when hp fraction equals threshold (10%)", () => {
    const result = checkAchievements(makeCtx({ hp: 10, maxHp: 100, lastDamageTaken: 5 }));
    expect(hasAchievement(result, "clutch")).toBe(true);
  });

  it("passes when hp fraction is below threshold (5%)", () => {
    const result = checkAchievements(makeCtx({ hp: 5, maxHp: 100, lastDamageTaken: 5 }));
    expect(hasAchievement(result, "clutch")).toBe(true);
  });

  it("fails when hp fraction is just above threshold (11%)", () => {
    const result = checkAchievements(makeCtx({ hp: 11, maxHp: 100, lastDamageTaken: 5 }));
    expect(hasAchievement(result, "clutch")).toBe(false);
  });

  it("fails when no damage taken", () => {
    const result = checkAchievements(makeCtx({ hp: 5, maxHp: 100, lastDamageTaken: 0 }));
    expect(hasAchievement(result, "clutch")).toBe(false);
  });

  it("fails when hp is 0", () => {
    const result = checkAchievements(makeCtx({ hp: 0, maxHp: 100, lastDamageTaken: 5 }));
    expect(hasAchievement(result, "clutch")).toBe(false);
  });
});

describe("evaluateCondition — consecutive-floors-no-shop", () => {
  // ascetic: consecutiveFloorsNoShop >= 3
  it("passes when exactly at threshold", () => {
    const result = checkAchievements(makeCtx({ consecutiveFloorsNoShop: 3 }));
    expect(hasAchievement(result, "ascetic")).toBe(true);
  });

  it("passes when above threshold", () => {
    const result = checkAchievements(makeCtx({ consecutiveFloorsNoShop: 7 }));
    expect(hasAchievement(result, "ascetic")).toBe(true);
  });

  it("fails when one below threshold", () => {
    const result = checkAchievements(makeCtx({ consecutiveFloorsNoShop: 2 }));
    expect(hasAchievement(result, "ascetic")).toBe(false);
  });

  it("fails when zero", () => {
    const result = checkAchievements(makeCtx({ consecutiveFloorsNoShop: 0 }));
    expect(hasAchievement(result, "ascetic")).toBe(false);
  });
});

describe("evaluateCondition — all-minigames-unlocked", () => {
  // collector: unlockedMinigamesCount >= 15
  it("passes when exactly 15 unlocked", () => {
    const result = checkAchievements(makeCtx({ unlockedMinigamesCount: 15 }));
    expect(hasAchievement(result, "collector")).toBe(true);
  });

  it("passes when more than 15 unlocked", () => {
    const result = checkAchievements(makeCtx({ unlockedMinigamesCount: 20 }));
    expect(hasAchievement(result, "collector")).toBe(true);
  });

  it("fails when 14 unlocked (one below)", () => {
    const result = checkAchievements(makeCtx({ unlockedMinigamesCount: 14 }));
    expect(hasAchievement(result, "collector")).toBe(false);
  });

  it("fails when default (5) unlocked", () => {
    const result = checkAchievements(makeCtx());
    expect(hasAchievement(result, "collector")).toBe(false);
  });
});

describe("evaluateCondition — total-minigames-won", () => {
  // first-blood: totalMinigamesWon >= 1
  it("passes when exactly 1 win", () => {
    const result = checkAchievements(makeCtx({ stats: makeStats({ totalMinigamesWon: 1 }) }));
    expect(hasAchievement(result, "first-blood")).toBe(true);
  });

  it("passes when multiple wins", () => {
    const result = checkAchievements(makeCtx({ stats: makeStats({ totalMinigamesWon: 50 }) }));
    expect(hasAchievement(result, "first-blood")).toBe(true);
  });

  it("fails when zero wins", () => {
    const result = checkAchievements(makeCtx({ stats: makeStats({ totalMinigamesWon: 0 }) }));
    expect(hasAchievement(result, "first-blood")).toBe(false);
  });
});

describe("evaluateCondition — minigame-win-streak", () => {
  // streak-master: currentWinStreak >= 15
  it("passes when exactly at threshold", () => {
    const result = checkAchievements(makeCtx({ currentWinStreak: 15 }));
    expect(hasAchievement(result, "streak-master")).toBe(true);
  });

  it("passes when above threshold", () => {
    const result = checkAchievements(makeCtx({ currentWinStreak: 20 }));
    expect(hasAchievement(result, "streak-master")).toBe(true);
  });

  it("fails when one below threshold (14)", () => {
    const result = checkAchievements(makeCtx({ currentWinStreak: 14 }));
    expect(hasAchievement(result, "streak-master")).toBe(false);
  });

  it("fails when zero", () => {
    const result = checkAchievements(makeCtx({ currentWinStreak: 0 }));
    expect(hasAchievement(result, "streak-master")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. evaluateNearMiss — thresholds
// ---------------------------------------------------------------------------

// evaluateNearMiss is not exported directly; we test via checkNearMisses.
// checkNearMisses returns achievements that pass near-miss but NOT the real condition.

describe("evaluateNearMiss — floor-reached", () => {
  // first-breach: floor >= 1  → near miss: floor >= 0 (i.e. floor == 0)
  // Use "script-kiddie" (floor: 5) → near miss: floor >= 4
  it("returns near miss when one floor below target", () => {
    const result = checkNearMisses(makeCtx({ floor: 4 }));
    expect(hasAchievement(result, "script-kiddie")).toBe(true);
  });

  it("does not return near miss when far from target", () => {
    const result = checkNearMisses(makeCtx({ floor: 1 }));
    expect(hasAchievement(result, "script-kiddie")).toBe(false);
  });

  it("does not return near miss when condition is already met (goes to checkAchievements)", () => {
    const result = checkNearMisses(makeCtx({ floor: 5 }));
    expect(hasAchievement(result, "script-kiddie")).toBe(false);
  });
});

describe("evaluateNearMiss — consecutive-floors-no-damage", () => {
  // ghost-run: count = 5 → near miss: consecutiveFloorsNoDamage >= 3 (count - 2)
  it("returns near miss when 2 below threshold (count - 2)", () => {
    const result = checkNearMisses(makeCtx({ consecutiveFloorsNoDamage: 3 }));
    expect(hasAchievement(result, "ghost-run")).toBe(true);
  });

  it("returns near miss when 1 below threshold (count - 1)", () => {
    const result = checkNearMisses(makeCtx({ consecutiveFloorsNoDamage: 4 }));
    expect(hasAchievement(result, "ghost-run")).toBe(true);
  });

  it("does not return near miss when far from threshold", () => {
    const result = checkNearMisses(makeCtx({ consecutiveFloorsNoDamage: 1 }));
    expect(hasAchievement(result, "ghost-run")).toBe(false);
  });

  it("does not return near miss when condition is met", () => {
    const result = checkNearMisses(makeCtx({ consecutiveFloorsNoDamage: 5 }));
    expect(hasAchievement(result, "ghost-run")).toBe(false);
  });
});

describe("evaluateNearMiss — speed-consecutive-floors", () => {
  // quick-dash: count=3, maxTimeMs=45_000 → near miss: window <= 45_000 * 1.3 = 58_500
  // Set up 3 timestamps with runStartTime such that window is within 1.3x but not within 1x
  it("returns near miss when time is within 1.3x limit", () => {
    const now = Date.now();
    // Window from runStartTime to timestamps[2] = 50_000ms (within 1.3x of 45_000)
    const ctx = makeCtx({
      runStartTime: now - 50_000,
      floorCompletionTimestamps: [now - 40_000, now - 20_000, now],
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "quick-dash")).toBe(true);
  });

  it("does not return near miss when time exceeds 1.3x limit", () => {
    const now = Date.now();
    // Window = 70_000ms — exceeds 58_500
    const ctx = makeCtx({
      runStartTime: now - 70_000,
      floorCompletionTimestamps: [now - 50_000, now - 30_000, now],
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "quick-dash")).toBe(false);
  });

  it("does not return near miss when condition is met (within original limit)", () => {
    const now = Date.now();
    // Window = 40_000ms — within 45_000ms limit, so condition is met → not a near miss
    const ctx = makeCtx({
      runStartTime: now - 40_000,
      floorCompletionTimestamps: [now - 30_000, now - 15_000, now],
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "quick-dash")).toBe(false);
  });
});

describe("evaluateNearMiss — minigame-streak (consecutive)", () => {
  // bracket-master: minigame="close-brackets", count=10 (< 15 → consecutive)
  // Near miss: streak >= count - 2 = 8
  it("returns near miss when streak is at count - 2", () => {
    const ctx = makeCtx({
      stats: makeStats({ minigameWinStreaks: { "close-brackets": 8 } }),
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "bracket-master")).toBe(true);
  });

  it("returns near miss when streak is at count - 1", () => {
    const ctx = makeCtx({
      stats: makeStats({ minigameWinStreaks: { "close-brackets": 9 } }),
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "bracket-master")).toBe(true);
  });

  it("does not return near miss when streak is far below threshold", () => {
    const ctx = makeCtx({
      stats: makeStats({ minigameWinStreaks: { "close-brackets": 5 } }),
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "bracket-master")).toBe(false);
  });

  it("does not return near miss when condition is met (streak >= 10)", () => {
    const ctx = makeCtx({
      stats: makeStats({ minigameWinStreaks: { "close-brackets": 10 } }),
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "bracket-master")).toBe(false);
  });
});

describe("evaluateNearMiss — minigame-streak (cumulative ≥ 15)", () => {
  // slash-veteran: minigame="slash-timing", count=50 (>= 15 → cumulative)
  // Near miss: total >= count * 0.8 = 40
  it("returns near miss when total is at 80% threshold", () => {
    const ctx = makeCtx({
      stats: makeStats({ minigameWinsTotal: { "slash-timing": 40 } }),
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "slash-veteran")).toBe(true);
  });

  it("returns near miss when total is above 80% but below 100%", () => {
    const ctx = makeCtx({
      stats: makeStats({ minigameWinsTotal: { "slash-timing": 45 } }),
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "slash-veteran")).toBe(true);
  });

  it("does not return near miss when total is below 80%", () => {
    const ctx = makeCtx({
      stats: makeStats({ minigameWinsTotal: { "slash-timing": 39 } }),
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "slash-veteran")).toBe(false);
  });

  it("does not return near miss when condition is met (total >= 50)", () => {
    const ctx = makeCtx({
      stats: makeStats({ minigameWinsTotal: { "slash-timing": 50 } }),
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "slash-veteran")).toBe(false);
  });
});

describe("evaluateNearMiss — total-runs", () => {
  // veteran: count=10 → near miss: totalRuns >= 8 (80%)
  it("returns near miss when at 80% of threshold", () => {
    const result = checkNearMisses(makeCtx({ stats: makeStats({ totalRuns: 8 }) }));
    expect(hasAchievement(result, "veteran")).toBe(true);
  });

  it("returns near miss when between 80% and 100%", () => {
    const result = checkNearMisses(makeCtx({ stats: makeStats({ totalRuns: 9 }) }));
    expect(hasAchievement(result, "veteran")).toBe(true);
  });

  it("does not return near miss when below 80%", () => {
    const result = checkNearMisses(makeCtx({ stats: makeStats({ totalRuns: 7 }) }));
    expect(hasAchievement(result, "veteran")).toBe(false);
  });

  it("does not return near miss when condition is met (totalRuns >= 10)", () => {
    const result = checkNearMisses(makeCtx({ stats: makeStats({ totalRuns: 10 }) }));
    expect(hasAchievement(result, "veteran")).toBe(false);
  });
});

describe("evaluateNearMiss — survive-low-hp", () => {
  // one-hp: maxHp=5 → near miss: lastDamageTaken > 0 && hp > 0 && hp <= 5 * 2 = 10
  it("returns near miss when hp is at 2x maxHp threshold (hp = 10)", () => {
    const result = checkNearMisses(makeCtx({ hp: 10, maxHp: 100, lastDamageTaken: 5 }));
    expect(hasAchievement(result, "one-hp")).toBe(true);
  });

  it("returns near miss when hp is between maxHp and 2x maxHp", () => {
    const result = checkNearMisses(makeCtx({ hp: 8, maxHp: 100, lastDamageTaken: 5 }));
    expect(hasAchievement(result, "one-hp")).toBe(true);
  });

  it("does not return near miss when hp is above 2x threshold", () => {
    const result = checkNearMisses(makeCtx({ hp: 11, maxHp: 100, lastDamageTaken: 5 }));
    expect(hasAchievement(result, "one-hp")).toBe(false);
  });

  it("does not return near miss when no damage was taken", () => {
    const result = checkNearMisses(makeCtx({ hp: 8, maxHp: 100, lastDamageTaken: 0 }));
    expect(hasAchievement(result, "one-hp")).toBe(false);
  });

  it("does not return near miss when condition is already met (hp <= 5)", () => {
    const result = checkNearMisses(makeCtx({ hp: 5, maxHp: 100, lastDamageTaken: 5 }));
    expect(hasAchievement(result, "one-hp")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. checkNearMisses — integration
// ---------------------------------------------------------------------------

describe("checkNearMisses — integration", () => {
  it("returns near-miss achievements that are not yet earned", () => {
    // floor 4 → near miss for script-kiddie (needs floor 5)
    const ctx = makeCtx({ floor: 4, earnedAchievements: [] });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "script-kiddie")).toBe(true);
  });

  it("does not return already-earned achievements", () => {
    const ctx = makeCtx({ floor: 4, earnedAchievements: ["script-kiddie"] });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "script-kiddie")).toBe(false);
  });

  it("does not return achievements that fully meet the condition (those belong to checkAchievements)", () => {
    // floor 5 → script-kiddie condition is met, should not appear in near misses
    const ctx = makeCtx({ floor: 5, earnedAchievements: [] });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "script-kiddie")).toBe(false);
  });

  it("can return multiple near-miss achievements at once", () => {
    // floor 4 → near miss for script-kiddie
    // consecutiveFloorsNoDamage 3 → near miss for ghost-run (needs 5, near miss at 3)
    const ctx = makeCtx({
      floor: 4,
      consecutiveFloorsNoDamage: 3,
      earnedAchievements: [],
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "script-kiddie")).toBe(true);
    expect(hasAchievement(result, "ghost-run")).toBe(true);
  });

  it("returns empty array when no conditions are near threshold", () => {
    const ctx = makeCtx({
      floor: 1,
      consecutiveFloorsNoDamage: 0,
      stats: makeStats({ totalRuns: 0 }),
    });
    const result = checkNearMisses(ctx);
    // script-kiddie near-miss requires floor >= 4, we're at 1, so it shouldn't appear
    expect(hasAchievement(result, "script-kiddie")).toBe(false);
    // ghost-run near-miss requires consecutiveFloorsNoDamage >= 3, we're at 0
    expect(hasAchievement(result, "ghost-run")).toBe(false);
  });

  it("does not return earned achievements even when near-miss condition is met", () => {
    // All three achievements earned — none should appear in near misses
    const ctx = makeCtx({
      floor: 4,
      consecutiveFloorsNoDamage: 4,
      earnedAchievements: ["script-kiddie", "ghost-run"],
    });
    const result = checkNearMisses(ctx);
    expect(hasAchievement(result, "script-kiddie")).toBe(false);
    expect(hasAchievement(result, "ghost-run")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkAchievements — integration smoke tests
// ---------------------------------------------------------------------------

describe("checkAchievements — integration", () => {
  it("returns no achievements when context is all-zero defaults", () => {
    // floor=1 meets "first-breach" (floor-reached: 1) — verify it works
    const ctx = makeCtx({ floor: 1 });
    const result = checkAchievements(ctx);
    expect(hasAchievement(result, "first-breach")).toBe(true);
  });

  it("skips already-earned achievements", () => {
    const ctx = makeCtx({ floor: 5, earnedAchievements: ["script-kiddie"] });
    const result = checkAchievements(ctx);
    expect(hasAchievement(result, "script-kiddie")).toBe(false);
  });

  it("returns multiple achievements when several conditions are met", () => {
    const ctx = makeCtx({
      floor: 5,
      stats: makeStats({ totalRuns: 3 }),
    });
    const result = checkAchievements(ctx);
    expect(hasAchievement(result, "script-kiddie")).toBe(true);
    expect(hasAchievement(result, "rookie")).toBe(true);
  });

  it("does not return achievements when no conditions are met", () => {
    const ctx = makeCtx({
      floor: 0,
      stats: makeStats({ totalRuns: 0 }),
    });
    const result = checkAchievements(ctx);
    // first-breach needs floor >= 1
    expect(hasAchievement(result, "first-breach")).toBe(false);
  });
});
