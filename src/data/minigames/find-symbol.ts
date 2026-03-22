import { FindSymbol } from "@/components/minigames/FindSymbol";
import type { MinigameConfig } from "./types";

export const findSymbolConfig: MinigameConfig = {
  id: "find-symbol",
  displayName: "Address Lookup",
  component: FindSymbol,
  baseTimeLimit: 12,
  starting: false,
  unlockPrice: 300,
  briefing: {
    rules: [
      "A target sequence is shown at the top of the screen",
      "Find and select the current target symbol in the grid below",
      "Match all targets in order to complete \u2014 wrong pick = failure",
    ],
    controls: {
      desktop: "Arrow keys + ENTER to navigate, or click with mouse",
      touch: "TAP the matching hex code in the grid",
    },
    tips: [
      "At higher difficulty visually similar symbols are mixed in \u2014 look carefully",
      "Use the cursor highlight to track your grid position with keyboard",
    ],
    hint: {
      desktop: "Click/select each target symbol in order.",
      touch: "TAP each target symbol in order.",
    },
  },
  metaUpgrades: [
    {
      id: "symbol-scanner",
      name: "Symbol Scanner",
      description: "The target hex code is subtly highlighted in the grid in Address Lookup.",
      category: "game-specific",
      maxTier: 1,
      prices: [200],
      effects: [{ type: "hint", value: 1, minigame: "find-symbol" }],
    },
  ],
};
