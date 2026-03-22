import { NetworkTrace } from "@/components/minigames/NetworkTrace";
import type { MinigameConfig } from "./types";

export const networkTraceConfig: MinigameConfig = {
  id: "network-trace",
  displayName: "Network Trace",
  component: NetworkTrace,
  baseTimeLimit: 20,
  starting: false,
  unlockPrice: "dynamic",
  briefing: {
    rules: [
      "A maze is generated \u2014 navigate from entry point to target server",
      "Use arrow keys to move through open paths",
      "Walls block movement \u2014 find the correct route through the maze",
      "Reach the target server (\u25ce) to succeed \u2014 fail only by timeout",
    ],
    controls: {
      desktop: "Arrow keys to move through the maze",
      touch: "Use the D-pad buttons to navigate the maze",
    },
    tips: [
      "Stick to one wall (left or right) and follow it \u2014 it always leads to the exit",
      "Larger mazes at higher difficulty \u2014 move quickly and stay oriented",
    ],
    hint: {
      desktop: "Navigate the maze from entry to target using arrow keys.",
      touch: "Navigate the maze from entry to target using the D-pad.",
    },
  },
  metaUpgrades: [
    {
      id: "network-trace-highlight",
      name: "Path Highlight",
      description: "Shows the correct path for 25/50/75/100% of the timer in Network Trace.",
      category: "game-specific",
      maxTier: 4,
      prices: [150, 300, 500, 750],
      effects: [
        { type: "minigame-specific", value: 0.25, minigame: "network-trace" },
        { type: "minigame-specific", value: 0.50, minigame: "network-trace" },
        { type: "minigame-specific", value: 0.75, minigame: "network-trace" },
        { type: "minigame-specific", value: 1.0, minigame: "network-trace" },
      ],
    },
  ],
};
