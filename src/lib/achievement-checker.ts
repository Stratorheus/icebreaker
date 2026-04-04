import { ACHIEVEMENT_POOL } from "@/data/achievements";
import type { Achievement, AchievementCondition } from "@/types/shop";
import type { MinigameType, PlayerStats } from "@/types/game";
import { ALL_MINIGAMES } from "@/data/minigames/registry";

// ---------------------------------------------------------------------------
// Check context — snapshot of game state at the time of evaluation
// ---------------------------------------------------------------------------

export interface AchievementCheckContext {
  // Current run state
  floor: number;
  floorDamageTaken: boolean;
  runDamageTaken: boolean;
  powerUpsUsedThisFloor: boolean;
  inventorySize: number;
  hp: number;
  maxHp: number;
  consecutiveFloorsNoDamage: number;
  floorCompletionTimestamps: number[];
  creditsSpentThisShop: number;
  consecutiveFloorsNoShop: number;
  lastDamageTaken: number;
  currentWinStreak: number;
  unlockedMinigamesCount: number;
  // Current run counts (not yet flushed to stats)
  minigamesWonThisRun: number;
  minigamesPlayedThisRun: number;
  // Meta state
  earnedAchievements: string[];
  stats: PlayerStats;
  // Last minigame result (only when checking after a minigame)
  lastMinigame?: { success: boolean; timeMs: number; type: MinigameType };
}

// ---------------------------------------------------------------------------
// Condition evaluator
// ---------------------------------------------------------------------------

function evaluateCondition(
  condition: AchievementCondition,
  ctx: AchievementCheckContext,
): boolean {
  switch (condition.type) {
    case "floor-reached":
      // True when the player has cleared up to (and including) that floor.
      // The shop appears after a floor is cleared, so ctx.floor is the floor
      // just completed.
      return ctx.floor >= condition.floor;

    case "minigame-streak": {
      // Consecutive win streak for a specific minigame (resets on failure).
      const streak = ctx.stats.minigameWinStreaks[condition.minigame] ?? 0;
      return streak >= condition.count;
    }

    case "minigame-total-wins": {
      // Cumulative total wins for a specific minigame (never resets).
      const total = ctx.stats.minigameWinsTotal[condition.minigame] ?? 0;
      return total >= condition.count;
    }

    case "minigame-speed": {
      // True when the last minigame was the right type, won, and fast enough.
      if (!ctx.lastMinigame) return false;
      return (
        ctx.lastMinigame.type === condition.minigame &&
        ctx.lastMinigame.success &&
        ctx.lastMinigame.timeMs <= condition.maxTimeMs
      );
    }

    case "inventory-count":
      return ctx.inventorySize >= condition.count;

    case "floor-no-powerups":
      // True when the floor was cleared without using any power-ups.
      return !ctx.powerUpsUsedThisFloor;

    case "total-runs":
      return ctx.stats.totalRuns >= condition.count;

    case "total-minigames":
      return (ctx.stats.totalMinigamesPlayed + ctx.minigamesPlayedThisRun) >= condition.count;

    case "consecutive-floors-no-damage":
      return ctx.consecutiveFloorsNoDamage >= condition.count;

    case "speed-consecutive-floors": {
      // timestamps[0] is the "floor 0" marker pushed at startRun.
      // Actual floor completions start at timestamps[1].
      const timestamps = ctx.floorCompletionTimestamps;
      // Need at least count+1 entries (floor-0 marker + count completions)
      if (timestamps.length < condition.count + 1) return false;
      // Check any window of `count` consecutive floor completions
      for (let i = condition.count; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i - condition.count] <= condition.maxTimeMs) return true;
      }
      return false;
    }

    case "shop-spending":
      return ctx.creditsSpentThisShop >= condition.amount;

    case "total-data-earned":
      return ctx.stats.totalDataEarned >= condition.amount;

    case "survive-low-hp":
      return ctx.lastDamageTaken > 0 && ctx.hp > 0 && ctx.hp <= condition.maxHp;

    case "survive-low-hp-pct":
      return ctx.lastDamageTaken > 0 && ctx.hp > 0 && (ctx.hp / ctx.maxHp) <= condition.maxPct;

    case "consecutive-floors-no-shop":
      return ctx.consecutiveFloorsNoShop >= condition.count;

    case "all-minigames-unlocked":
      return ctx.unlockedMinigamesCount >= ALL_MINIGAMES.length;

    case "total-minigames-won":
      return (ctx.stats.totalMinigamesWon + ctx.minigamesWonThisRun) >= condition.count;

    case "minigame-win-streak":
      return ctx.currentWinStreak >= condition.count;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Near-miss evaluator — checks if player is close to earning an achievement
// ---------------------------------------------------------------------------

function evaluateNearMiss(
  condition: AchievementCondition,
  ctx: AchievementCheckContext,
): boolean {
  switch (condition.type) {
    case "floor-reached":
      return ctx.floor >= condition.floor - 1;

    case "consecutive-floors-no-damage":
      return ctx.consecutiveFloorsNoDamage >= condition.count - 2;

    case "speed-consecutive-floors": {
      // Check if player completed enough floors but was too slow (within 30% of time)
      const timestamps = ctx.floorCompletionTimestamps;
      if (timestamps.length < condition.count + 1) return false;
      for (let i = condition.count; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i - condition.count] <= condition.maxTimeMs * 1.3) return true;
      }
      return false;
    }

    case "minigame-streak": {
      const streak = ctx.stats.minigameWinStreaks[condition.minigame] ?? 0;
      return streak >= condition.count - 2;
    }

    case "minigame-total-wins": {
      const total = ctx.stats.minigameWinsTotal[condition.minigame] ?? 0;
      return total >= condition.count * 0.8;
    }

    case "minigame-speed":
      if (!ctx.lastMinigame) return false;
      return (
        ctx.lastMinigame.type === condition.minigame &&
        ctx.lastMinigame.success &&
        ctx.lastMinigame.timeMs <= condition.maxTimeMs * 1.3
      );

    case "total-runs":
      return ctx.stats.totalRuns >= condition.count * 0.8;

    case "total-minigames":
      return (ctx.stats.totalMinigamesPlayed + ctx.minigamesPlayedThisRun) >= condition.count * 0.8;

    case "total-data-earned":
      return ctx.stats.totalDataEarned >= condition.amount * 0.8;

    case "total-minigames-won":
      return (ctx.stats.totalMinigamesWon + ctx.minigamesWonThisRun) >= condition.count * 0.8;

    case "shop-spending":
      return ctx.creditsSpentThisShop >= condition.amount * 0.7;

    case "survive-low-hp":
      return ctx.lastDamageTaken > 0 && ctx.hp > 0 && ctx.hp <= condition.maxHp * 2;

    case "survive-low-hp-pct":
      return ctx.lastDamageTaken > 0 && ctx.hp > 0 && (ctx.hp / ctx.maxHp) <= condition.maxPct * 2;

    case "inventory-count":
      return ctx.inventorySize >= condition.count - 1;

    case "consecutive-floors-no-shop":
      return ctx.consecutiveFloorsNoShop >= condition.count - 1;

    case "minigame-win-streak":
      return ctx.currentWinStreak >= condition.count - 2;

    // These don't have meaningful near-miss
    case "floor-no-powerups":
    case "all-minigames-unlocked":
      return false;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Main checker
// ---------------------------------------------------------------------------

/**
 * Evaluates all unearned achievements against the current context.
 * Returns only newly-earned achievements (does not mutate state).
 */
export function checkAchievements(
  ctx: AchievementCheckContext,
): Achievement[] {
  return ACHIEVEMENT_POOL.filter((achievement) => {
    // Skip already-earned
    if (ctx.earnedAchievements.includes(achievement.id)) return false;
    return evaluateCondition(achievement.condition, ctx);
  });
}

/**
 * Checks for achievements the player nearly earned but didn't quite meet.
 * Returns achievements that are close to being earned but not yet unlocked.
 */
export function checkNearMisses(
  ctx: AchievementCheckContext,
): Achievement[] {
  return ACHIEVEMENT_POOL.filter((achievement) => {
    // Skip already-earned
    if (ctx.earnedAchievements.includes(achievement.id)) return false;
    // Skip if actually earned this check
    if (evaluateCondition(achievement.condition, ctx)) return false;
    // Check near miss
    return evaluateNearMiss(achievement.condition, ctx);
  });
}
