/**
 * Pure balancing functions — no side effects, no imports.
 * All math comes directly from the design spec.
 */

/** Returns difficulty scalar 0–1 based on current floor. Starts at 0.1, reaches max ~floor 13. */
export function getDifficulty(floor: number): number {
  return Math.min(0.1 + floor / 15, 1.0);
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

/** Bonus data awarded at milestone floors. Every 5th floor gets a milestone, scaling linearly. */
export function getMilestoneBonus(floor: number): number {
  if (floor > 0 && floor % 5 === 0) {
    return floor * 5; // floor 5=25, 10=50, 15=75, 20=100, 50=250, 100=500
  }
  return 0;
}

/** Price of a run-shop item scaled to the current floor depth. Quadratic scaling keeps late-game shops expensive. */
export function getRunShopPrice(basePrice: number, floor: number): number {
  return Math.round(basePrice * (1 + floor * 0.25) * (1 + floor * floor * 0.01));
}

/**
 * Adjusted time limit in seconds for a minigame.
 * Higher difficulty compresses the available window.
 * At difficulty 0 the full baseTime is available;
 * at difficulty 1 the player gets 60 % of baseTime.
 *
 * After floor 15, time keeps shrinking by 2% per floor down to 40%
 * of the already-reduced time, so late-game stays challenging even
 * after minigame difficulty maxes out.
 */
export function getTimeLimit(baseTime: number, difficulty: number, floor?: number): number {
  const difficultyScale = 1 - difficulty * 0.4;
  const floorScale = floor && floor > 15
    ? Math.max(0.4, 1 - (floor - 15) * 0.02)
    : 1;
  return Math.round(baseTime * difficultyScale * floorScale);
}
