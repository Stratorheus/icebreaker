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
  /**
   * Whether the skip counts as a success (null-route / skip-silent)
   * or simply advances without credit (plain skip / backdoor).
   */
  asSilentSuccess: boolean;
}

/**
 * Check the inventory for a skip-type power-up.
 *
 * Priority:
 *   1. "skip-silent" (null-route) — auto-passes, counts as success but 0 credits
 *   2. "skip"        (backdoor)   — skips without penalty, counts as success
 *   3. "skip-floor"  (emergency-exit) — NOT handled here; it skips the whole
 *      floor and needs special logic in MinigameScreen / store.
 */
export function checkSkip(inventory: PowerUpInstance[]): SkipResult {
  const silentSkip = inventory.find((p) => p.effect.type === "skip-silent");
  if (silentSkip) {
    return { skip: true, consumeId: silentSkip.id, asSilentSuccess: true };
  }

  const plainSkip = inventory.find((p) => p.effect.type === "skip");
  if (plainSkip) {
    return { skip: true, consumeId: plainSkip.id, asSilentSuccess: false };
  }

  return { skip: false, consumeId: null, asSilentSuccess: false };
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
