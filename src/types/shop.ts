import type { MinigameType } from "./game";

export interface RunShopItem {
  id: string;
  name: string;
  description: string;
  category: "time" | "defense" | "skip" | "healing" | "vision" | "assist";
  basePrice: number;
  effect: { type: string; value: number; minigame?: MinigameType };
  icon: string;
}

export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  category: "stat" | "starting-bonus" | "minigame-unlock" | "game-specific";
  maxTier: number;
  prices: number[]; // price per tier (for stackable: base price at index 0)
  effects: { type: string; value: number; minigame?: MinigameType }[];
  requires?: string; // prerequisite upgrade id
  stackable?: boolean; // if true, can be purchased infinitely with scaling price
}

export type AchievementCategory = "progression" | "skill" | "speed" | "economy" | "survival" | "playstyle" | "cumulative";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: AchievementCondition;
  reward: number; // data
  icon: string;
  category: AchievementCategory;
}

export type AchievementCondition =
  | { type: "floor-reached"; floor: number }
  | { type: "minigame-streak"; minigame: MinigameType; count: number }
  | { type: "minigame-total-wins"; minigame: MinigameType; count: number }
  | { type: "minigame-speed"; minigame: MinigameType; maxTimeMs: number }
  | { type: "inventory-count"; count: number }
  | { type: "floor-no-powerups" }
  | { type: "total-runs"; count: number }
  | { type: "total-minigames"; count: number }
  | { type: "consecutive-floors-no-damage"; count: number }
  | { type: "speed-consecutive-floors"; count: number; maxTimeMs: number }
  | { type: "shop-spending"; amount: number }
  | { type: "total-data-earned"; amount: number }
  | { type: "survive-low-hp"; maxHp: number }
  | { type: "survive-low-hp-pct"; maxPct: number }
  | { type: "consecutive-floors-no-shop"; count: number }
  | { type: "all-minigames-unlocked" }
  | { type: "total-minigames-won"; count: number }
  | { type: "minigame-win-streak"; count: number };
