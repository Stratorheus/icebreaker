import type { MinigameType, PowerUpInstance, PowerUpEffect } from "@/types/game";
import type { MinigameConfig, MinigameBriefing } from "./types";
import type { MinigameProps } from "@/types/minigame";

// Import all 15 configs
import { slashTimingConfig } from "./slash-timing";
import { closeBracketsConfig } from "./close-brackets";
import { typeBackwardConfig } from "./type-backward";
import { matchArrowsConfig } from "./match-arrows";
import { mineSweepConfig } from "./mine-sweep";
import { findSymbolConfig } from "./find-symbol";
import { wireCuttingConfig } from "./wire-cutting";
import { cipherCrackConfig } from "./cipher-crack";
import { defragConfig } from "./defrag";
import { networkTraceConfig } from "./network-trace";
import { signalEchoConfig } from "./signal-echo";
import { checksumVerifyConfig } from "./checksum-verify";
import { portScanConfig } from "./port-scan";
import { subnetScanConfig } from "./subnet-scan";
import { cipherCrackV2Config } from "./cipher-crack-v2";

export const MINIGAME_REGISTRY: Record<MinigameType, MinigameConfig> = {
  "slash-timing": slashTimingConfig,
  "close-brackets": closeBracketsConfig,
  "type-backward": typeBackwardConfig,
  "match-arrows": matchArrowsConfig,
  "mine-sweep": mineSweepConfig,
  "find-symbol": findSymbolConfig,
  "wire-cutting": wireCuttingConfig,
  "cipher-crack": cipherCrackConfig,
  "defrag": defragConfig,
  "network-trace": networkTraceConfig,
  "signal-echo": signalEchoConfig,
  "checksum-verify": checksumVerifyConfig,
  "port-scan": portScanConfig,
  "subnet-scan": subnetScanConfig,
  "cipher-crack-v2": cipherCrackV2Config,
};

// Derived data
export const MINIGAME_COMPONENTS = Object.fromEntries(
  Object.entries(MINIGAME_REGISTRY).map(([id, cfg]) => [id, cfg.component]),
) as Record<MinigameType, React.ComponentType<MinigameProps>>;

export const BASE_TIME_LIMITS = Object.fromEntries(
  Object.entries(MINIGAME_REGISTRY).map(([id, cfg]) => [id, cfg.baseTimeLimit]),
) as Record<MinigameType, number>;

export const STARTING_MINIGAMES: MinigameType[] = Object.values(MINIGAME_REGISTRY)
  .filter((cfg) => cfg.starting)
  .map((cfg) => cfg.id);

export const UNLOCKABLE_MINIGAMES: MinigameType[] = Object.values(MINIGAME_REGISTRY)
  .filter((cfg) => !cfg.starting)
  .map((cfg) => cfg.id);

export const ALL_MINIGAMES: MinigameType[] = Object.keys(MINIGAME_REGISTRY) as MinigameType[];

export function getMinigameDisplayName(type: MinigameType): string {
  return MINIGAME_REGISTRY[type].displayName;
}

export function getMinigameBriefing(type: MinigameType): MinigameBriefing {
  return MINIGAME_REGISTRY[type].briefing;
}

/**
 * Build synthetic PowerUpInstances from a minigame's meta upgrades.
 *
 * Default mode (no overrides): uses purchasedUpgrades to determine which
 * upgrades are active and at what tier — used by MinigameScreen during runs.
 *
 * Training mode (with overrides): uses explicit activeIds/tierMap so players
 * can selectively enable upgrades at chosen tiers during practice.
 */
export function buildMetaPowerUps(
  purchasedUpgrades: Record<string, number>,
  type: MinigameType,
  overrides?: {
    activeIds: Set<string>;
    tierMap: Record<string, number>;
  },
): PowerUpInstance[] {
  const config = MINIGAME_REGISTRY[type];
  const synth: PowerUpInstance[] = [];
  for (const upgrade of config.metaUpgrades) {
    let tier: number;
    if (overrides) {
      if (!overrides.activeIds.has(upgrade.id)) continue;
      tier = overrides.tierMap[upgrade.id] ?? 1;
    } else {
      tier = purchasedUpgrades[upgrade.id] ?? 0;
      if (tier <= 0) continue;
    }
    const effect = upgrade.effects[tier - 1] ?? upgrade.effects[upgrade.effects.length - 1];
    synth.push({
      id: `meta-${upgrade.id}`,
      type: `meta-${upgrade.id}`,
      name: upgrade.name,
      description: upgrade.description,
      effect: {
        type: effect.type as PowerUpEffect["type"],
        value: effect.value,
        minigame: effect.minigame,
      },
    });
  }
  return synth;
}
