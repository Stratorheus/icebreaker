import type { MinigameType, PowerUpInstance } from "./game";

export interface MinigameProps {
  difficulty: number; // 0-1 scale
  timeLimit: number; // seconds
  activePowerUps: PowerUpInstance[];
  onComplete: (result: MinigameResult) => void;
}

export interface MinigameResult {
  success: boolean;
  timeMs: number;
  minigame: MinigameType;
  /** True if the deadline-override power-up was triggered during this minigame. */
  deadlineTriggered?: boolean;
}
