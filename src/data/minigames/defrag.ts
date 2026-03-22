import { Defrag } from "@/components/minigames/Defrag";
import type { MinigameConfig } from "./types";

export const defragConfig: MinigameConfig = {
  id: "defrag",
  displayName: "Defrag",
  component: Defrag,
  baseTimeLimit: 40,
  starting: false,
  unlockPrice: "dynamic",
  briefing: {
    rules: [
      "Grid of hidden cells \u2014 some contain mines",
      "Uncover cells to reveal numbers (count of adjacent mines)",
      "Cells with 0 adjacent mines auto-expand in a flood fill",
      "Uncover all safe cells to win \u2014 hitting a mine = fail",
    ],
    controls: {
      desktop: "Arrow keys to move, SPACE to uncover, ENTER to flag. Mouse: L-click uncover, R-click flag",
      touch: "TAP to uncover (toggle FLAG mode for flagging)",
    },
    tips: [
      "Use numbers to deduce mine positions \u2014 flag suspected mines",
      "Start near the center for better odds of hitting a 0-cell cascade",
    ],
    hint: {
      desktop: "Uncover cells, avoid mines. Numbers show adjacent mine count.",
      touch: "Tap cells to uncover, avoid mines. Numbers = adjacent mine count.",
    },
  },
  metaUpgrades: [
    {
      id: "mine-radar",
      name: "Mine Radar",
      description: "Shows mine count per row and column for 25/50/75/100% of the timer in Defrag.",
      category: "game-specific",
      maxTier: 4,
      prices: [150, 300, 500, 750],
      effects: [
        { type: "minigame-specific", value: 0.25, minigame: "defrag" },
        { type: "minigame-specific", value: 0.50, minigame: "defrag" },
        { type: "minigame-specific", value: 0.75, minigame: "defrag" },
        { type: "minigame-specific", value: 1.0, minigame: "defrag" },
      ],
    },
  ],
};
