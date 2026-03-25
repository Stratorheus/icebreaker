import type { MinigameType } from "@/types/game";
import { getMinigamesPerFloor } from "@/data/balancing";

/**
 * Post-process an array so no element appears more than `maxRun` times
 * consecutively. When a violation is found, swap with a different random
 * element from `pool`.
 */
function enforceVariety<T>(arr: T[], pool: T[], maxRun: number): T[] {
  if (pool.length <= 1) return arr;
  const result = [...arr];
  for (let i = maxRun; i < result.length; i++) {
    // Check if the last `maxRun` elements are all the same as result[i]
    let allSame = true;
    for (let j = 1; j <= maxRun; j++) {
      if (result[i - j] !== result[i]) {
        allSame = false;
        break;
      }
    }
    if (allSame) {
      // Pick a different element
      const alternatives = pool.filter((x) => x !== result[i]);
      if (alternatives.length > 0) {
        result[i] = alternatives[Math.floor(Math.random() * alternatives.length)];
      }
    }
  }
  return result;
}

/**
 * Generate an array of minigames for a given floor.
 *
 * Returns `getMinigamesPerFloor(floor, diffReducerTier)` entries randomly
 * selected from the unlocked pool (repeats within a floor are allowed).
 * No minigame type appears more than 2 times consecutively.
 */
export function generateFloor(
  floor: number,
  unlockedMinigames: MinigameType[],
  diffReducerTier: number = 0,
): MinigameType[] {
  const count = getMinigamesPerFloor(floor, diffReducerTier);
  const result: MinigameType[] = [];

  for (let i = 0; i < count; i++) {
    result.push(
      unlockedMinigames[Math.floor(Math.random() * unlockedMinigames.length)],
    );
  }

  return enforceVariety(result, unlockedMinigames, 2);
}
