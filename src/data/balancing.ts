/**
 * Pure balancing functions — no side effects, no imports.
 * All math comes directly from the design spec.
 */

/** Returns damage dealt to player on a failed minigame. */
function getDamage(floor: number): number {
  return 20 + floor * 4;
}

/**
 * Credits awarded after a minigame win.
 * Base 20 × (1 + difficulty) × speed bonus.
 * Speed bonus: completing under 10 s earns up to +50%.
 */
function getCredits(timeMs: number, difficulty: number): number {
  const base = 20 * (1 + difficulty);
  const speedBonus = 1 + Math.max(0, 1 - timeMs / 10_000) * 0.5;
  return Math.round(base * speedBonus);
}

/** Number of minigames presented on a given floor (caps at 8). */
export function getMinigamesPerFloor(floor: number): number {
  return Math.min(1 + floor, 8);
}

/** Data (◆) rewarded for clearing a floor. Sublinear to avoid early-floor windfalls. */
export function getDataReward(floor: number): number {
  return Math.round(3 + floor * 4);
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

// ---------------------------------------------------------------------------
// Centralized power-up stacking helpers
// ---------------------------------------------------------------------------
// Canonical order: FLAT FIRST, PERCENTAGES LAST.
// Percentages amplify everything below them.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Difficulty labels (SSOT — used by Training picker AND vendor display)
// ---------------------------------------------------------------------------

export const DIFFICULTY_OPTIONS = [
  { label: "TRIVIAL", value: 0.05 },
  { label: "EASY", value: 0.15 },
  { label: "NORMAL", value: 0.30 },
  { label: "MEDIUM", value: 0.50 },
  { label: "HARD", value: 0.70 },
  { label: "EXPERT", value: 0.85 },
  { label: "INSANE", value: 1.00 },
] as const;

/** Map a 0-1 difficulty scalar to the closest named label. */
export function getDifficultyLabel(difficulty: number): string {
  let closestLabel = DIFFICULTY_OPTIONS[0].label as string;
  let closestDist = Math.abs(DIFFICULTY_OPTIONS[0].value - difficulty);
  for (const opt of DIFFICULTY_OPTIONS) {
    const dist = Math.abs(opt.value - difficulty);
    if (dist < closestDist) {
      closestLabel = opt.label;
      closestDist = dist;
    }
  }
  return closestLabel;
}

/**
 * Compute effective difficulty with meta Difficulty Reducer applied.
 */
export function getEffectiveDifficulty(floor: number, diffReducerTier: number): number {
  return Math.min(0.1 + floor / (15 + diffReducerTier * 2), 1.0);
}

/**
 * Compute effective time limit with all stacking applied.
 * Order: base + flat bonuses, then x percentage multipliers.
 */
export function getEffectiveTimeLimit(
  baseTimeLimitSecs: number,
  difficulty: number,
  floor: number,
  timeSiphonBonus: number,
  cascadeClockPct: number,
  delayInjectorTier: number,
): number {
  const base = getTimeLimit(baseTimeLimitSecs, difficulty, floor);
  return Math.round((base + timeSiphonBonus) * (1 + cascadeClockPct) * Math.pow(1.03, delayInjectorTier));
}

/**
 * Compute base damage with Thicker Armor meta applied.
 */
export function getEffectiveDamage(floor: number, armorTier: number): number {
  const raw = getDamage(floor);
  const armorReductions = [0, 0.05, 0.10, 0.15, 0.20, 0.25]; // index 0 = no armor
  const reduction = armorReductions[Math.min(armorTier, armorReductions.length - 1)] ?? 0;
  return Math.round(raw * (1 - reduction));
}

/** Per-minigame data drip reward. Scales with floor depth. */
export function getDataDrip(floor: number): number {
  return Math.round(1 + floor * 0.8);
}

/**
 * Credits-to-data conversion rate (8% of eligible credits).
 * Only credits earned during gameplay count — Head Start bonus credits
 * are excluded. Starting credits are spent first, so eligible credits
 * = min(earnedThisRun, currentCredits).
 */
export function getCreditsSaved(currentCredits: number, earnedThisRun: number): number {
  return Math.floor(Math.min(earnedThisRun, currentCredits) * 0.08);
}

/**
 * Starting credits for a run, combining the base 25 CR floor with the
 * Head Start meta upgrade bonus (5 tiers: +50/+125/+300/+600/+1000).
 * Index 0 = no upgrade.
 */
export function getStartingCredits(headStartTier: number): number {
  const bonuses = [0, 50, 125, 300, 600, 1000];
  return 25 + (bonuses[Math.min(headStartTier, bonuses.length - 1)] ?? 0);
}

/** Data reward with Data Siphon meta applied. */
export function getEffectiveDataReward(floor: number, dataSiphonTier: number): number {
  return Math.round(getDataReward(floor) * Math.pow(1.03, dataSiphonTier));
}

/** Death penalty percentage (reduced by Data Recovery meta). Voluntary quit = 0. */
export function getDeathPenaltyPct(dataRecoveryTier: number, quitVoluntarily: boolean): number {
  if (quitVoluntarily) return 0;
  return Math.max(0.10, 0.25 - dataRecoveryTier * 0.025);
}

/**
 * Compute credits earned with all meta bonuses.
 * Order: base + speedTax flat, then x credit multiplier x unlock bonus.
 */
export function getEffectiveCredits(
  timeMs: number,
  difficulty: number,
  creditTier: number,
  speedTaxTier: number,
  unlockBonus: number,
): number {
  const base = getCredits(timeMs, difficulty);
  const speedTaxFlat = speedTaxTier > 0 ? Math.round(base * speedTaxTier * 0.05) : 0;
  const withFlat = base + speedTaxFlat;
  const creditMultiplier = Math.pow(1.03, creditTier);
  return Math.round(withFlat * creditMultiplier * (1 + unlockBonus));
}
