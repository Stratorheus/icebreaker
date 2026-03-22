import { SlashTiming } from "@/components/minigames/SlashTiming";
import type { MinigameConfig } from "./types";

export const slashTimingConfig: MinigameConfig = {
  id: "slash-timing",
  displayName: "Slash Timing",
  component: SlashTiming,
  baseTimeLimit: 8,
  starting: true,
  briefing: {
    rules: [
      "Three phases cycle in sequence: GUARD \u2192 PREPARE \u2192 ATTACK",
      "Press SPACE only during the green ATTACK window to succeed",
      "Pressing SPACE during GUARD or PREPARE causes immediate failure",
      "Missing the ATTACK window restarts the cycle \u2014 keep waiting",
    ],
    controls: {
      desktop: "SPACE \u2014 strike",
      touch: "TAP \u2014 strike",
    },
    tips: [
      "Watch for the PREPARE phase as your cue to get ready",
      "At higher difficulty the ATTACK window shrinks \u2014 precision matters",
    ],
    hint: {
      desktop: "Wait for the GREEN flash, then press Space.",
      touch: "Wait for the GREEN flash, then TAP.",
    },
  },
  metaUpgrades: [
    {
      id: "slash-window",
      name: "Slash Window",
      description: "The attack window in Slash Timing is 25 % wider.",
      category: "game-specific",
      maxTier: 1,
      prices: [175],
      effects: [{ type: "window-extend", value: 0.25, minigame: "slash-timing" }],
    },
  ],
};
