import type { MetaUpgrade } from "@/types/shop";
import { STAT_UPGRADES } from "./stat";
import { DEFENSE_UPGRADES } from "./defense";
import { STARTING_UPGRADES } from "./starting";
import { MINIGAME_REGISTRY } from "../minigames/registry";

export const META_UPGRADE_POOL: MetaUpgrade[] = [
  ...STAT_UPGRADES,
  ...DEFENSE_UPGRADES,
  ...STARTING_UPGRADES,
  // Auto-generated minigame unlock licenses
  // licenseId on the config overrides the default "{id}-license" pattern
  // to preserve save compatibility for IDs that don't follow the template.
  ...Object.values(MINIGAME_REGISTRY)
    .filter((cfg) => !cfg.starting && cfg.unlockPrice != null)
    .map((cfg) => ({
      id: cfg.licenseId ?? `${cfg.id}-license`,
      name: `${cfg.displayName} License`,
      description: `Unlocks the ${cfg.displayName} protocol.`,
      category: "minigame-unlock" as const,
      maxTier: 1,
      prices: [cfg.unlockPrice === "dynamic" ? 0 : (cfg.unlockPrice as number)],
      effects: [{ type: "unlock-minigame", value: 1, minigame: cfg.id }],
      ...(cfg.unlockPrice === "dynamic" ? { dynamicPrice: true } : {}),
      ...(cfg.requires ? { requires: cfg.requires } : {}),
    })),
  // Game-specific upgrades from minigame configs
  ...Object.values(MINIGAME_REGISTRY).flatMap((cfg) => cfg.metaUpgrades),
];
