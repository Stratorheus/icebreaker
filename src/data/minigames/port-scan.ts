import { PortScan } from "@/components/minigames/PortScan";
import type { MinigameConfig } from "./types";

export const portScanConfig: MinigameConfig = {
  id: "port-scan",
  displayName: "Port Scan",
  component: PortScan,
  baseTimeLimit: 15,
  starting: false,
  unlockPrice: "dynamic",
  briefing: {
    rules: [
      "A grid of port numbers is displayed \u2014 open ports flash green one by one",
      "Memorize which ports flash during the display phase (timer paused)",
      "After display, select all open ports \u2014 selecting a wrong port = immediate failure",
      "All correct selections = success; timer runs during the select phase",
    ],
    controls: {
      desktop: "Arrow keys to navigate, SPACE to toggle select, or click with mouse",
      touch: "TAP to select open ports",
    },
    tips: [
      "Group open ports by position during the display phase",
      "Higher difficulty increases grid size and the number of open ports",
    ],
    hint: {
      desktop: "Memorize which ports flash green, then select them all.",
      touch: "Memorize which ports flash green, then tap them all.",
    },
  },
  metaUpgrades: [
    {
      id: "port-scan-deep",
      name: "Deep Scan",
      description: "Open ports flash twice instead of once in Port Scan.",
      category: "game-specific",
      maxTier: 1,
      prices: [200],
      effects: [{ type: "minigame-specific", value: 2, minigame: "port-scan" }],
    },
    {
      id: "port-logger",
      name: "Port Logger",
      description: "Shows a text list of open port numbers during the selection phase in Port Scan.",
      category: "game-specific",
      maxTier: 1,
      prices: [200],
      effects: [{ type: "hint", value: 1, minigame: "port-scan" }],
    },
  ],
};
