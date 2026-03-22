import { CloseBrackets } from "@/components/minigames/CloseBrackets";
import type { MinigameConfig } from "./types";

export const closeBracketsConfig: MinigameConfig = {
  id: "close-brackets",
  displayName: "Code Inject",
  component: CloseBrackets,
  baseTimeLimit: 8,
  starting: true,
  briefing: {
    rules: [
      "A sequence of opening brackets is displayed",
      "Type the matching closing brackets in REVERSE order (stack style)",
      "Bracket pairs: ( \u2192 )  [ \u2192 ]  { \u2192 }  < \u2192 >  | \u2192 |  \\ \u2192 /",
      "Any wrong key causes immediate failure",
      "Note: Some bracket types may be removed by the Bracket Reducer upgrade",
    ],
    controls: {
      desktop: "Keyboard keys: ) ] } > | /",
      touch: "TAP the matching closer buttons below",
    },
    tips: [
      "Read the opening sequence from right to left to find your first key",
      "Build muscle memory for each bracket pair before timed runs",
    ],
    hint: {
      desktop: "Type closing brackets in REVERSE order.",
      touch: "TAP closing brackets in REVERSE order.",
    },
  },
  metaUpgrades: [
    {
      id: "bracket-reducer",
      name: "Bracket Reducer",
      description: "Removes bracket types from Code Inject. Tier 1: slash, Tier 2: +pipe, Tier 3: +square brackets. Remaining: ( { <",
      category: "game-specific",
      maxTier: 3,
      prices: [150, 300, 500],
      effects: [
        { type: "minigame-specific", value: 1, minigame: "close-brackets" },
        { type: "minigame-specific", value: 2, minigame: "close-brackets" },
        { type: "minigame-specific", value: 3, minigame: "close-brackets" },
      ],
    },
    {
      id: "bracket-mirror",
      name: "Bracket Mirror",
      description: "Shows the next expected closing bracket in Code Inject.",
      category: "game-specific",
      maxTier: 1,
      prices: [150],
      effects: [{ type: "bracket-flash", value: 1, minigame: "close-brackets" }],
    },
  ],
};
