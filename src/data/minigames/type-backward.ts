import { TypeBackward } from "@/components/minigames/TypeBackward";
import type { MinigameConfig } from "./types";

export const typeBackwardConfig: MinigameConfig = {
  id: "type-backward",
  displayName: "Decrypt Signal",
  component: TypeBackward,
  baseTimeLimit: 18,
  starting: true,
  briefing: {
    rules: [
      "Mirrored (reversed) words are displayed in scrambled order",
      "Read each mirrored word and type the ORIGINAL word it represents",
      "Work through them left to right \u2014 any wrong key = immediate failure",
      "Decode and type all words to succeed",
    ],
    controls: {
      desktop: "Keyboard \u2014 type each letter of the original word",
      touch: "System keyboard \u2014 type each letter of the original word",
    },
    tips: [
      "Read the mirrored word backwards in your head to find the original",
      "Short words first \u2014 longer words appear at higher difficulty",
    ],
    hint: {
      desktop: "Read mirrored words, type the originals in order.",
      touch: "Read mirrored words, type the originals in order.",
    },
  },
  metaUpgrades: [
    {
      id: "reverse-trainer",
      name: "Autocorrect",
      description: "Shows 25/50/75/100% of words in normal order in Decrypt Signal. Corrected words are marked.",
      category: "game-specific",
      maxTier: 4,
      prices: [150, 300, 500, 750],
      effects: [
        { type: "minigame-specific", value: 0.25, minigame: "type-backward" },
        { type: "minigame-specific", value: 0.50, minigame: "type-backward" },
        { type: "minigame-specific", value: 0.75, minigame: "type-backward" },
        { type: "minigame-specific", value: 1.0, minigame: "type-backward" },
      ],
    },
  ],
};
