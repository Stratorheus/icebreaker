import { toast } from "sonner";
import { useGameStore } from "@/store/game-store";
import {
  checkAchievements,
  type AchievementCheckContext,
} from "@/lib/achievement-checker";

// ---------------------------------------------------------------------------
// Centralized achievement evaluator — reads everything from the store
// ---------------------------------------------------------------------------

/**
 * Evaluate and award achievements based on current store state.
 * Call this once — it reads everything it needs from the store,
 * including `lastMinigameResult` (set by completeMinigame / failMinigame).
 *
 * No parameters needed.
 */
export function evaluateAndAwardAchievements(): void {
  const state = useGameStore.getState();

  const ctx: AchievementCheckContext = {
    floor: state.floor,
    floorDamageTaken: state.floorDamageTaken,
    runDamageTaken: state.runDamageTaken,
    powerUpsUsedThisFloor: state.powerUpsUsedThisFloor,
    inventorySize: state.inventory.length,
    hp: state.hp,
    maxHp: state.maxHp,
    runStartTime: state.runStartTime,
    consecutiveFloorsNoDamage: state.consecutiveFloorsNoDamage,
    floorCompletionTimestamps: state.floorCompletionTimestamps,
    creditsSpentThisShop: state.creditsSpentThisShop,
    consecutiveFloorsNoShop: state.consecutiveFloorsNoShop,
    lastDamageTaken: state.lastDamageTaken,
    currentWinStreak: state.currentWinStreak,
    unlockedMinigamesCount: state.unlockedMinigames.length,
    earnedAchievements: state.achievements,
    stats: state.stats,
    lastMinigame: state.lastMinigameResult ?? undefined,
  };

  const earned = checkAchievements(ctx);
  if (earned.length === 0) return;

  for (const achievement of earned) {
    state.unlockAchievement(achievement.id);
    state.addData(achievement.reward);
    toast(`\u{1F3C6} Achievement Unlocked!`, {
      description: `${achievement.name} — +${achievement.reward} \u25C6`,
    });
  }
}

// ---------------------------------------------------------------------------
// Hook — returns a stable callback for use in components
// ---------------------------------------------------------------------------

/**
 * Returns a stable `check` function. Components call this at the right moment
 * to evaluate and award achievements.
 */
export function useAchievementCheck() {
  return { evaluateAndAwardAchievements };
}
