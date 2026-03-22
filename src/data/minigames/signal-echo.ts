import { SignalEcho } from "@/components/minigames/SignalEcho";
import type { MinigameConfig } from "./types";

export const signalEchoConfig: MinigameConfig = {
  id: "signal-echo",
  displayName: "Signal Echo",
  component: SignalEcho,
  baseTimeLimit: 20,
  starting: false,
  unlockPrice: "dynamic",
  briefing: {
    rules: [
      "4 colored panels (Up=Cyan, Right=Magenta, Down=Green, Left=Orange)",
      "Watch the sequence light up, then repeat it with arrow keys or clicks",
      "Each successful round adds one more step to the sequence",
      "Any wrong input = immediate failure",
    ],
    controls: {
      desktop: "Arrow keys or click the panels to repeat the sequence",
      touch: "TAP the panels to repeat the sequence",
    },
    tips: [
      "Verbalize the directions as the sequence plays (e.g. 'up, left, down...')",
      "Higher difficulty starts with longer sequences and faster display speed",
    ],
    hint: {
      desktop: "Repeat the signal pattern in the correct sequence.",
      touch: "Repeat the signal pattern by tapping panels in order.",
    },
  },
  metaUpgrades: [
    {
      id: "signal-echo-slow",
      name: "Slow Replay",
      description: "Sequence plays 30 % slower in Signal Echo.",
      category: "game-specific",
      maxTier: 1,
      prices: [200],
      effects: [{ type: "minigame-specific", value: 0.3, minigame: "signal-echo" }],
    },
  ],
};
