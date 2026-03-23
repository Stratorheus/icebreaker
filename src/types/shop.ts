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

export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: AchievementCondition;
  reward: number; // data
  icon: string;
}

export type AchievementCondition =
  | { type: "floor-reached"; floor: number }
  | { type: "floor-no-damage"; floor: number }
  | { type: "speed-run"; floors: [number, number]; maxTimeMs: number }
  | { type: "minigame-streak"; minigame: MinigameType; count: number }
  | { type: "minigame-speed"; minigame: MinigameType; maxTimeMs: number }
  | { type: "inventory-count"; count: number }
  | { type: "floor-no-powerups" }
  | { type: "total-runs"; count: number }
  | { type: "total-minigames"; count: number }
  | { type: "consecutive-floors-no-damage"; count: number }
  | { type: "speed-consecutive-floors"; count: number; maxTimeMs: number };
