import { MineSweep } from "@/components/minigames/MineSweep";
import type { MinigameConfig } from "./types";

export const mineSweepConfig: MinigameConfig = {
  id: "mine-sweep",
  displayName: "Memory Scan",
  component: MineSweep,
  baseTimeLimit: 15,
  starting: true,
  briefing: {
    rules: [
      "Corrupted sectors are revealed briefly in a PREVIEW phase \u2014 memorise their locations",
      "Sectors hide during the MARK phase \u2014 mark the cells you memorised",
      "Marking exactly the correct cells wins; any wrong mark = failure",
      "The grid auto-checks when you've marked the same count as corrupted sectors",
    ],
    controls: {
      desktop: "Arrow keys + SPACE to mark, or click cells",
      touch: "TAP to mark corrupted sectors",
    },
    tips: [
      "Group corrupted sectors by row or region in your mind during preview",
      "Higher difficulty = more corrupted sectors, smaller preview window \u2014 act fast",
    ],
    hint: {
      desktop: "Memorize corrupted sector positions during the preview phase.",
      touch: "Memorize corrupted sector positions during the preview phase.",
    },
  },
  metaUpgrades: [
    {
      id: "mine-echo",
      name: "Memory Echo",
      description: "20/30/40/50/60% of corrupted sectors remain visible at the start of Memory Scan.",
      category: "game-specific",
      maxTier: 5,
      prices: [150, 250, 400, 600, 850],
      effects: [
        { type: "minigame-specific", value: 0.20, minigame: "mine-sweep" },
        { type: "minigame-specific", value: 0.30, minigame: "mine-sweep" },
        { type: "minigame-specific", value: 0.40, minigame: "mine-sweep" },
        { type: "minigame-specific", value: 0.50, minigame: "mine-sweep" },
        { type: "minigame-specific", value: 0.60, minigame: "mine-sweep" },
      ],
    },
  ],
};
