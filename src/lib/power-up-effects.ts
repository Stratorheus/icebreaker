import type { PowerUpInstance } from "@/types/game";

// ---------------------------------------------------------------------------
// Shield — consume on next fail, reduce or negate damage
// ---------------------------------------------------------------------------

export interface ShieldResult {
  /** Final damage to apply (0 if fully blocked). */
  damage: number;
  /** ID of the consumed power-up, or null if not fully consumed yet. */
  consumed: string | null;
  /** ID of a power-up whose remainingUses should be decremented (not removed). */
  decremented: string | null;
}

/**
 * Check the inventory for the strongest shield-type power-up and apply it.
 *
 * Priority (highest protection first):
 *   1. "shield"                    — full block (damage = 0), consumed
 *   2. "damage-reduction-stacked"  — partial reduction, uses-tracked
 *   3. "damage-reduction"          — partial reduction, consumed on trigger
 *
 * Only ONE power-up is applied per call (the strongest wins).
 * Damage is clamped to a minimum of 0.
 */
export function applyShield(
  inventory: PowerUpInstance[],
  baseDamage: number,
): ShieldResult {
  // Full shield (firewall-patch) — highest priority
  const fullShield = inventory.find((p) => p.effect.type === "shield");
  if (fullShield) {
    return { damage: 0, consumed: fullShield.id, decremented: null };
  }

  // Stacked damage-reduction (redundancy-layer) — has multiple uses
  const stackedReducer = inventory.find(
    (p) => p.effect.type === "damage-reduction-stacked",
  );
  if (stackedReducer) {
    const factor = stackedReducer.effect.value;
    const dmg = Math.max(0, Math.round(baseDamage * factor));
    const uses = stackedReducer.remainingUses ?? 1;
    if (uses <= 1) {
      // Last use — consume entirely
      return { damage: dmg, consumed: stackedReducer.id, decremented: null };
    }
    // Decrement remaining uses
    return { damage: dmg, consumed: null, decremented: stackedReducer.id };
  }

  // Simple damage-reduction (damage-reducer) — single use
  const reducer = inventory.find((p) => p.effect.type === "damage-reduction");
  if (reducer) {
    const factor = reducer.effect.value;
    const dmg = Math.max(0, Math.round(baseDamage * factor));
    return { damage: dmg, consumed: reducer.id, decremented: null };
  }

  return { damage: baseDamage, consumed: null, decremented: null };
}

// ---------------------------------------------------------------------------
// Skip — consume on next minigame, auto-advance without playing
// ---------------------------------------------------------------------------

export interface SkipResult {
  /** Whether the current minigame should be skipped. */
  skip: boolean;
  /** ID of the power-up to consume, or null if no skip is active. */
  consumeId: string | null;
  /** All skip types count as a silent success (streak-safe). */
  asSilentSuccess: boolean;
  /** True only for Warp Gate (skip-floor) — skips all remaining protocols on the floor. */
  skipFloor: boolean;
  /** Reward fraction: 0 = no rewards (Backdoor), 1 = full (Null Route), 0.15 = 15% (Warp Gate). */
  rewardFraction: number;
}

/**
 * Check the inventory for a skip-type power-up.
 *
 * Priority (highest value first):
 *   1. "skip-floor"  (Warp Gate)   — skips all remaining protocols, 15% rewards
 *   2. "skip-silent" (Null Route)  — auto-passes, full rewards
 *   3. "skip"        (Backdoor)    — skips without playing, 0 rewards
 *
 * All three count as a success (asSilentSuccess: true).
 */
export function checkSkip(inventory: PowerUpInstance[]): SkipResult {
  // Warp Gate: skip entire remaining floor at 15% rewards
  const floorSkip = inventory.find((p) => p.effect.type === "skip-floor");
  if (floorSkip) {
    return {
      skip: true,
      consumeId: floorSkip.id,
      asSilentSuccess: true,
      skipFloor: true,
      rewardFraction: floorSkip.effect.value, // 0.15
    };
  }

  // Null Route: auto-pass with full rewards
  const silentSkip = inventory.find((p) => p.effect.type === "skip-silent");
  if (silentSkip) {
    return {
      skip: true,
      consumeId: silentSkip.id,
      asSilentSuccess: true,
      skipFloor: false,
      rewardFraction: 1,
    };
  }

  // Backdoor: skip with no rewards
  const plainSkip = inventory.find((p) => p.effect.type === "skip");
  if (plainSkip) {
    return {
      skip: true,
      consumeId: plainSkip.id,
      asSilentSuccess: true,
      skipFloor: false,
      rewardFraction: 0,
    };
  }

  return { skip: false, consumeId: null, asSilentSuccess: false, skipFloor: false, rewardFraction: 1 };
}

// ---------------------------------------------------------------------------
// Meta upgrade bonuses — lookup helpers for game-specific upgrades
// ---------------------------------------------------------------------------

export function getMetaBonus(
  purchasedUpgrades: Record<string, number>,
  upgradeId: string,
): number {
  return purchasedUpgrades[upgradeId] ?? 0;
}
