import { WireCutting } from "@/components/minigames/WireCutting";
import type { MinigameConfig } from "./types";

export const wireCuttingConfig: MinigameConfig = {
  id: "wire-cutting",
  displayName: "Process Kill",
  component: WireCutting,
  baseTimeLimit: 12,
  starting: false,
  unlockPrice: 300,
  licenseId: "wire-cutting-toolkit",
  briefing: {
    rules: [
      "A set of coloured processes and a rule panel are displayed",
      "Read the rules carefully to deduce the correct termination order",
      "Press the number key matching a process to terminate it",
      "Wrong order = immediate failure; terminate all required processes to succeed",
    ],
    controls: {
      desktop: "Number keys 1\u20139 to terminate processes, or click a process",
      touch: "TAP a process to terminate it",
    },
    tips: [
      "Some processes are marked DO NOT TERMINATE \u2014 leave those alone",
      "Work out the full order mentally before making the first termination",
    ],
    hint: {
      desktop: "Terminate processes in the order shown by the sequence.",
      touch: "Terminate processes in the order shown by the sequence.",
    },
  },
  metaUpgrades: [
    {
      id: "wire-labels",
      name: "Stream Monitor",
      description: "Dims non-target processes and highlights the next process to terminate.",
      category: "game-specific",
      maxTier: 1,
      prices: [200],
      effects: [{ type: "wire-color-labels", value: 1, minigame: "wire-cutting" }],
    },
  ],
};
