import type { MetaUpgrade } from "@/types/shop";

/** Survivability upgrades — armor, recovery, regeneration. */
export const DEFENSE_UPGRADES: MetaUpgrade[] = [
  {
    id: "thicker-armor",
    name: "Thicker Armor",
    description: "Permanently reduces incoming damage by 5/10/15/20/25%.",
    category: "stat",
    maxTier: 5,
    prices: [100, 200, 350, 500, 750],
    effects: [
      { type: "damage-reduction", value: 0.05 },
      { type: "damage-reduction", value: 0.10 },
      { type: "damage-reduction", value: 0.15 },
      { type: "damage-reduction", value: 0.20 },
      { type: "damage-reduction", value: 0.25 },
    ],
  },
  {
    id: "data-recovery",
    name: "Data Recovery",
    description: "Reduces death penalty from 25% to 22.5/20/17.5/15/12.5/10%.",
    category: "stat",
    maxTier: 6,
    prices: [100, 200, 300, 400, 550, 750],
    effects: [
      { type: "death-penalty-reduction", value: 0.025 },
      { type: "death-penalty-reduction", value: 0.05 },
      { type: "death-penalty-reduction", value: 0.075 },
      { type: "death-penalty-reduction", value: 0.10 },
      { type: "death-penalty-reduction", value: 0.125 },
      { type: "death-penalty-reduction", value: 0.15 },
    ],
  },
  {
    id: "emergency-patch",
    name: "Emergency Patch",
    description: "Regenerate 2% of max HP at the start of each floor. Stackable.",
    category: "stat",
    maxTier: 999,
    prices: [120], // dynamic pricing via getStackablePrice()
    effects: [{ type: "floor-regen", value: 0.02 }],
    stackable: true,
  },
];
