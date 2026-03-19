/**
 * Pure balancing functions — no side effects, no imports.
 * All math comes directly from the design spec.
 */

/** Returns difficulty scalar 0–1 based on current floor. Starts at 0.15 so floor 1 isn't trivial. */
export function getDifficulty(floor: number): number {
  return Math.min(0.15 + floor / 12, 1.0);
}

/** Returns damage dealt to player on a failed minigame. */
export function getDamage(floor: number): number {
  return 20 + floor * 4;
}

/**
 * Credits awarded after a minigame win.
 * Base 20 × (1 + difficulty) × speed bonus.
 * Speed bonus: completing under 10 s earns up to +50%.
 */
export function getCredits(timeMs: number, difficulty: number): number {
  const base = 20 * (1 + difficulty);
  const speedBonus = 1 + Math.max(0, 1 - timeMs / 10_000) * 0.5;
  return Math.round(base * speedBonus);
}

/** Number of minigames presented on a given floor (caps at 8). */
export function getMinigamesPerFloor(floor: number): number {
  return Math.min(1 + floor, 8);
}

/** Data (◆) rewarded for clearing a floor. */
export function getDataReward(floor: number): number {
  return floor * 10;
}

/** Bonus data awarded at milestone floors. */
export function getMilestoneBonus(floor: number): number {
  switch (floor) {
    case 5:  return 50;
    case 10: return 100;
    case 15: return 200;
    case 20: return 500;
    default: return 0;
  }
}

/** Price of a run-shop item scaled to the current floor depth. */
export function getRunShopPrice(basePrice: number, floor: number): number {
  return Math.round(basePrice * (1 + floor * 0.15));
}

/**
 * Adjusted time limit in seconds for a minigame.
 * Higher difficulty compresses the available window.
 * At difficulty 0 the full baseTime is available;
 * at difficulty 1 the player gets 60 % of baseTime.
 *
 * After floor 10, time keeps shrinking by 3% per floor down to 50%
 * of the already-reduced time, so late-game stays challenging even
 * after minigame difficulty maxes out.
 */
export function getTimeLimit(baseTime: number, difficulty: number, floor?: number): number {
  const difficultyScale = 1 - difficulty * 0.4;
  const floorScale = floor && floor > 10
    ? Math.max(0.5, 1 - (floor - 10) * 0.03)
    : 1;
  return Math.round(baseTime * difficultyScale * floorScale);
}
