import { MatchArrows } from "@/components/minigames/MatchArrows";
import type { MinigameConfig } from "./types";

export const matchArrowsConfig: MinigameConfig = {
  id: "match-arrows",
  displayName: "Packet Route",
  component: MatchArrows,
  baseTimeLimit: 8,
  starting: true,
  briefing: {
    rules: [
      "A row of hidden arrow slots is shown \u2014 one is revealed at a time",
      "Press the matching arrow key to advance to the next slot",
      "Wrong arrow key = immediate failure",
      "Match all arrows in sequence to complete",
    ],
    controls: {
      desktop: "Arrow keys: \u2191 \u2193 \u2190 \u2192",
      touch: "Use the D-pad buttons below",
    },
    tips: [
      "Focus on each revealed arrow one at a time, not the full row",
      "At higher difficulty the row gets longer \u2014 stay calm and methodical",
    ],
    hint: {
      desktop: "Press the arrow key that matches the revealed arrow.",
      touch: "Tap the D-pad direction that matches the revealed arrow.",
    },
  },
  metaUpgrades: [
    {
      id: "arrow-preview",
      name: "Arrow Preview",
      description: "20/30/40/50/60% of the arrow sequence is pre-revealed in Packet Route.",
      category: "game-specific",
      maxTier: 5,
      prices: [150, 250, 400, 600, 850],
      effects: [
        { type: "peek-ahead", value: 0.20, minigame: "match-arrows" },
        { type: "peek-ahead", value: 0.30, minigame: "match-arrows" },
        { type: "peek-ahead", value: 0.40, minigame: "match-arrows" },
        { type: "peek-ahead", value: 0.50, minigame: "match-arrows" },
        { type: "peek-ahead", value: 0.60, minigame: "match-arrows" },
      ],
    },
  ],
};
