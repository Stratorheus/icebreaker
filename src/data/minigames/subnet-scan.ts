import { SubnetScan } from "@/components/minigames/SubnetScan";
import type { MinigameConfig } from "./types";

export const subnetScanConfig: MinigameConfig = {
  id: "subnet-scan",
  displayName: "Subnet Scan",
  component: SubnetScan,
  baseTimeLimit: 20,
  starting: false,
  unlockPrice: "dynamic",
  briefing: {
    rules: [
      "An IP range (CIDR notation) is displayed at the top",
      "A list of IP addresses is shown below the range",
      "Select all addresses that belong to the displayed subnet",
      "Wrong selection = immediate failure; all correct = success",
    ],
    controls: {
      desktop: "Arrow keys to navigate, SPACE to toggle, or click",
      touch: "TAP to select matching IP addresses",
    },
    tips: [
      "/24 = first 3 numbers must match, /16 = first 2, /8 = first 1",
      "A help box at the bottom explains the current subnet mask",
    ],
    hint: {
      desktop: "Select IPs that belong to the displayed CIDR range.",
      touch: "Tap IPs that belong to the displayed CIDR range.",
    },
  },
  metaUpgrades: [
    {
      id: "subnet-cidr-helper",
      name: "CIDR Helper",
      description: "Shows expanded IP range instead of just CIDR notation in Subnet Scan.",
      category: "game-specific",
      maxTier: 1,
      prices: [225],
      effects: [{ type: "minigame-specific", value: 1, minigame: "subnet-scan" }],
    },
  ],
};
