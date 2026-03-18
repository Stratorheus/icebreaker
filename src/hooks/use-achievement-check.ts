import { toast } from "sonner";
import { useGameStore } from "@/store/game-store";
import {
  checkAchievements,
  type AchievementCheckContext,
} from "@/lib/achievement-checker";
import type { MinigameType } from "@/types/game";

// ---------------------------------------------------------------------------
// Award helper — call after state is already updated in the store
// ---------------------------------------------------------------------------

/**
 * Reads current store state, checks for newly earned achievements,
 * awards data and shows toasts for each.
 *
 * `lastMinigame` is optional — pass only when checking after a minigame.
 */
export function awardNewAchievements(
  lastMinigame?: { success: boolean; timeMs: number; type: MinigameType },
): void {
  const state = useGameStore.getState();

  const ctx: AchievementCheckContext = {
    floor: state.floor,
    floorDamageTaken: state.floorDamageTaken,
    runDamageTaken: state.runDamageTaken,
    powerUpsUsedThisFloor: state.powerUpsUsedThisFloor,
    inventorySize: state.inventory.length,
    hp: state.hp,
    runStartTime: state.runStartTime,
    earnedAchievements: state.achievements,
    stats: state.stats,
    lastMinigame,
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
  return { awardNewAchievements };
}
