import type { PowerUpInstance } from "@/types/game";

// ---------------------------------------------------------------------------
// Shield — consume on next fail, reduce or negate damage
// ---------------------------------------------------------------------------

export interface ShieldResult {
  /** Final damage to apply (0 if fully blocked). */
  damage: number;
  /** ID of the consumed power-up, or null if no shield was active. */
  consumed: string | null;
}

/**
 * Check the inventory for the strongest shield-type power-up and apply it.
 *
 * Priority (highest protection first):
 *   1. "shield"            — full block (damage = 0)
 *   2. "damage-reduction-stacked" — partial reduction, consumed like a shield
 *   3. "damage-reduction"  — partial reduction, consumed on trigger
 *
 * Only ONE power-up is consumed per call (the best one wins).
 */
export function applyShield(
  inventory: PowerUpInstance[],
  baseDamage: number,
): ShieldResult {
  // Full shield (firewall-patch)
  const fullShield = inventory.find((p) => p.effect.type === "shield");
  if (fullShield) {
    return { damage: 0, consumed: fullShield.id };
  }

  // Stacked damage-reduction-stacked (redundancy-layer)
  const stackedReducer = inventory.find(
    (p) => p.effect.type === "damage-reduction-stacked",
  );
  if (stackedReducer) {
    const factor = stackedReducer.effect.value; // e.g. 0.25 → take 25% damage
    return {
      damage: Math.round(baseDamage * factor),
      consumed: stackedReducer.id,
    };
  }

  // Simple damage-reduction (damage-reducer)
  const reducer = inventory.find((p) => p.effect.type === "damage-reduction");
  if (reducer) {
    const factor = reducer.effect.value; // e.g. 0.5 → take 50% damage
    return {
      damage: Math.round(baseDamage * factor),
      consumed: reducer.id,
    };
  }

  return { damage: baseDamage, consumed: null };
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

/**
 * Return the *numeric value* of the currently purchased tier for `upgradeId`,
 * or `defaultValue` if the upgrade was never purchased.
 *
 * The `effects` array on each MetaUpgrade is indexed by tier (1-based):
 *   tier 1 → effects[0], tier 2 → effects[1], …
 *
 * This function mirrors that lookup without importing META_UPGRADE_POOL so
 * that callers can pass the pre-looked-up effects array.
 *
 * For simple one-shot lookups where you only need "do I have tier N",
 * prefer `getUpgradeTier` from the store directly.
 */
export function getMetaBonus(
  purchasedUpgrades: Record<string, number>,
  upgradeId: string,
): number {
  return purchasedUpgrades[upgradeId] ?? 0;
}
