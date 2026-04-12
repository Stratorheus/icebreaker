// Extends spec's 5 statuses with 'codex' and 'meta-shop' for direct navigation
export type GameStatus = "menu" | "playing" | "shop" | "dead" | "training" | "codex" | "meta-shop" | "stats" | "milestone" | "about" | "support";

export type MinigameType =
  | "slash-timing"
  | "close-brackets"
  | "type-backward"
  | "match-arrows"
  | "find-symbol"
  | "mine-sweep"
  | "wire-cutting"
  | "cipher-crack"
  | "defrag"
  | "network-trace"
  | "signal-echo"
  | "checksum-verify"
  | "port-scan"
  | "subnet-scan"
  | "cipher-crack-v2";

export interface PowerUpInstance {
  id: string;
  type: string;
  name: string;
  description: string;
  effect: PowerUpEffect;
  /** Remaining uses before auto-consumed. Undefined = single-use (consumed on first trigger). */
  remainingUses?: number;
}

export interface PowerUpEffect {
  type:
    | "time-bonus"
    | "time-multiplier"
    | "time-pause"
    | "shield"
    | "damage-reduction"
    | "damage-reduction-stacked"
    | "skip"
    | "skip-floor"
    | "skip-silent"
    | "heal"
    | "heal-on-success"
    | "preview"
    | "hint"
    | "highlight-danger"
    | "window-extend"
    | "peek-ahead"
    | "minigame-specific"
    | "bracket-flash"
    | "time-siphon"
    | "deadline-override"
    | "cascade-clock"
    | "hp-leech"
    | "floor-regen"
    | "extra-hint"
    | "wire-color-labels";
  value: number;
  minigame?: MinigameType;
}

export type TrainingOrigin = "picker" | "meta-shop" | null;

export interface PlayerStats {
  totalRuns: number;
  bestFloor: number;
  totalMinigamesPlayed: number;
  totalMinigamesWon: number;
  totalCreditsEarned: number;
  totalDataEarned: number;
  totalPlayTimeMs: number;
  /** Consecutive wins per minigame type (resets on failure). */
  minigameWinStreaks: Partial<Record<MinigameType, number>>;
  /** Cumulative wins per minigame type across all runs. */
  minigameWinsTotal: Partial<Record<MinigameType, number>>;
}
