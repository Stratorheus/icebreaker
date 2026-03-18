import { ACHIEVEMENT_POOL } from "@/data/achievements";
import type { Achievement, AchievementCondition } from "@/types/shop";
import type { MinigameType, PlayerStats } from "@/types/game";

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
  runStartTime: number;
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

    case "floor-no-damage":
      // True when the player cleared the given floor without taking damage
      // in the entire run up to that point.
      return ctx.floor >= condition.floor && !ctx.runDamageTaken;

    case "speed-run": {
      // True when floors [start, end] were completed within maxTimeMs.
      const [start, end] = condition.floors;
      if (ctx.floor < end) return false;
      const elapsed = Date.now() - ctx.runStartTime;
      return elapsed <= condition.maxTimeMs && ctx.floor >= start;
    }

    case "minigame-streak": {
      // Checks the persisted win streak (consecutive) OR cumulative total.
      // Streaks with large counts (>= 15) are treated as cumulative total wins.
      // Streaks with smaller counts are consecutive (reset on failure).
      const minigame = condition.minigame;
      const streak = ctx.stats.minigameWinStreaks[minigame] ?? 0;
      const total = ctx.stats.minigameWinsTotal[minigame] ?? 0;
      // Use total for cumulative achievements (count >= 15), streak otherwise
      const isCumulative = condition.count >= 15;
      return isCumulative
        ? total >= condition.count
        : streak >= condition.count;
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
      return ctx.stats.totalMinigamesPlayed >= condition.count;

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
