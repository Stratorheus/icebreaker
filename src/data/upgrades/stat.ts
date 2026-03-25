import type { MetaUpgrade } from "@/types/shop";

/** Economy upgrades — credits, data, difficulty, time, speed. */
export const STAT_UPGRADES: MetaUpgrade[] = [
  {
    id: "hp-boost",
    name: "HP Boost",
    description: "Each purchase gives +5 max HP. Infinitely stackable.",
    category: "stat",
    maxTier: 999,
    prices: [100], // dynamic pricing via getStackablePrice()
    effects: [{ type: "max-hp", value: 5 }],
    stackable: true,
  },
  {
    id: "credit-multiplier",
    name: "Credit Multiplier",
    description: "Each purchase gives +3% credits (multiplicative). Infinitely stackable.",
    category: "stat",
    maxTier: 999,
    prices: [100],
    effects: [{ type: "credit-bonus", value: 0.03 }],
    stackable: true,
  },
  {
    id: "data-siphon",
    name: "Data Siphon",
    description: "Each purchase gives +3% data (multiplicative). Infinitely stackable.",
    category: "stat",
    maxTier: 999,
    prices: [100],
    effects: [{ type: "data-bonus", value: 0.03 }],
    stackable: true,
  },
  {
    id: "difficulty-reducer",
    name: "Difficulty Reducer",
    description: "Delays difficulty scaling — each level pushes max difficulty 2 floors further.",
    category: "stat",
    maxTier: 999,
    prices: [150], // dynamic pricing via getStackablePrice()
    effects: [{ type: "difficulty-reduction", value: 0.02 }],
    stackable: true,
  },
  {
    id: "speed-tax",
    name: "Speed Tax",
    description: "Speed bonuses on credits are 15 / 25 / 40 % more effective.",
    category: "stat",
    maxTier: 3,
    prices: [100, 250, 500],
    effects: [
      { type: "speed-bonus-multiplier", value: 0.15 },
      { type: "speed-bonus-multiplier", value: 0.25 },
      { type: "speed-bonus-multiplier", value: 0.4 },
    ],
  },
  {
    id: "cascade-clock",
    name: "Cascade Clock",
    description: "Each consecutive win adds +2% base timer. Resets on fail. Cap: 10% per tier (up to 50% at tier 5).",
    category: "stat",
    maxTier: 5,
    prices: [150, 300, 500, 750, 1000],
    effects: [
      { type: "cascade-clock", value: 0.10 },
      { type: "cascade-clock", value: 0.20 },
      { type: "cascade-clock", value: 0.30 },
      { type: "cascade-clock", value: 0.40 },
      { type: "cascade-clock", value: 0.50 },
    ],
  },
  {
    id: "delay-injector",
    name: "Delay Injector",
    description: "Increases all timers by 3% per purchase (multiplicative).",
    category: "stat",
    maxTier: 999,
    prices: [100], // dynamic pricing via getStackablePrice()
    effects: [{ type: "global-time-bonus", value: 0.03 }],
    stackable: true,
  },
  {
    id: "supply-line",
    name: "Supply Line",
    description: "Expand vendor inventory: 4 items at tier 1, 6 items at tier 2.",
    category: "stat",
    maxTier: 2,
    prices: [300, 600],
    effects: [
      { type: "shop-slots", value: 4 },
      { type: "shop-slots", value: 6 },
    ],
  },
];
