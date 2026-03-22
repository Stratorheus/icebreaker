import { WireCutting } from "@/components/minigames/WireCutting";
import type { MinigameConfig } from "./types";

export const wireCuttingConfig: MinigameConfig = {
  id: "wire-cutting",
  displayName: "Wire Cutting",
  component: WireCutting,
  baseTimeLimit: 12,
  starting: false,
  unlockPrice: 300,
  licenseId: "wire-cutting-toolkit",
  briefing: {
    rules: [
      "A set of coloured wires and a rule panel are displayed",
      "Read the rules carefully to deduce the correct cutting order",
      "Press the number key matching a wire to cut it",
      "Wrong order = immediate failure; cut all required wires to succeed",
    ],
    controls: {
      desktop: "Number keys 1\u20139 to cut wires, or click a wire",
      touch: "TAP a wire to cut it",
    },
    tips: [
      "Some wires are marked DO NOT CUT \u2014 leave those alone",
      "Work out the full order mentally before making the first cut",
    ],
    hint: {
      desktop: "Cut wires in the order shown by the sequence.",
      touch: "Cut wires in the order shown by the sequence.",
    },
  },
  metaUpgrades: [
    {
      id: "wire-labels",
      name: "Wire Guide",
      description: "Dims non-target wires and highlights the next wire to cut.",
      category: "game-specific",
      maxTier: 1,
      prices: [200],
      effects: [{ type: "wire-color-labels", value: 1, minigame: "wire-cutting" }],
    },
  ],
};
