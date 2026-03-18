import type { MinigameType } from "@/types/game";
import { getMinigamesPerFloor } from "@/data/balancing";

/**
 * Generate an array of minigames for a given floor.
 *
 * Returns `getMinigamesPerFloor(floor)` entries randomly selected
 * from the unlocked pool (repeats within a floor are allowed).
 *
 * This is a simple v1 implementation — full polish comes in Task 23.
 */
export function generateFloor(
  floor: number,
  unlockedMinigames: MinigameType[],
): MinigameType[] {
  const count = getMinigamesPerFloor(floor);
  const result: MinigameType[] = [];

  for (let i = 0; i < count; i++) {
    result.push(
      unlockedMinigames[Math.floor(Math.random() * unlockedMinigames.length)],
    );
  }

  return result;
}
