// Extends spec's 5 statuses with 'codex' and 'meta-shop' for direct navigation
export type GameStatus = "menu" | "playing" | "shop" | "dead" | "training" | "codex" | "meta-shop" | "stats";

export type MinigameType =
  | "slash-timing"
  | "close-brackets"
  | "type-backward"
  | "match-arrows"
  | "find-symbol"
  | "mine-sweep"
  | "wire-cutting"
  | "cipher-crack";

export const STARTING_MINIGAMES: MinigameType[] = [
  "slash-timing",
  "close-brackets",
  "type-backward",
  "match-arrows",
  "mine-sweep",
];

export const UNLOCKABLE_MINIGAMES: MinigameType[] = [
  "find-symbol",
  "wire-cutting",
  "cipher-crack",
];

export interface PowerUpInstance {
  id: string;
  type: string;
  name: string;
  description: string;
  effect: PowerUpEffect;
}

export interface PowerUpEffect {
  type: "time-bonus" | "shield" | "skip" | "heal" | "minigame-specific";
  value: number;
  minigame?: MinigameType;
}

export interface PlayerStats {
  totalRuns: number;
  bestFloor: number;
  totalMinigamesPlayed: number;
  totalMinigamesWon: number;
  totalCreditsEarned: number;
  totalDataEarned: number;
  totalPlayTimeMs: number;
}
