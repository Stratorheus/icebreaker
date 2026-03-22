import { ChecksumVerify } from "@/components/minigames/ChecksumVerify";
import type { MinigameConfig } from "./types";

export const checksumVerifyConfig: MinigameConfig = {
  id: "checksum-verify",
  displayName: "Checksum Verify",
  component: ChecksumVerify,
  baseTimeLimit: 15,
  starting: false,
  unlockPrice: "dynamic",
  briefing: {
    rules: [
      "A series of math expressions is displayed one at a time",
      "Type the correct answer using number keys (0-9) and minus (-)",
      "Press ENTER or SPACE to confirm \u2014 wrong answer = immediate failure",
      "Solve all expressions to verify the data integrity",
    ],
    controls: {
      desktop: "Number keys (0-9), minus (-), Backspace, ENTER/SPACE to confirm",
      touch: "Number pad \u2014 type answer, TAP CONFIRM to submit",
    },
    tips: [
      "At low difficulty it's simple addition/subtraction \u2014 stay calm",
      "Higher difficulty adds two-digit math and multiplication up to 9x9",
    ],
    hint: {
      desktop: "Solve each math expression \u2014 type the answer and press Enter.",
      touch: "Solve each math expression \u2014 type the answer and tap CONFIRM.",
    },
  },
  metaUpgrades: [
    {
      id: "error-margin",
      name: "Error Margin",
      description: "Answers within \u00b11/\u00b12/\u00b13/\u00b14/\u00b15 of the correct value are accepted in Checksum Verify.",
      category: "game-specific",
      maxTier: 5,
      prices: [100, 200, 350, 500, 700],
      effects: [
        { type: "hint", value: 1, minigame: "checksum-verify" },
        { type: "hint", value: 2, minigame: "checksum-verify" },
        { type: "hint", value: 3, minigame: "checksum-verify" },
        { type: "hint", value: 4, minigame: "checksum-verify" },
        { type: "hint", value: 5, minigame: "checksum-verify" },
      ],
    },
    {
      id: "range-hint",
      name: "Range Hint",
      description: "Shows the answer range: \u00b110/\u00b15/\u00b13 in Checksum Verify.",
      category: "game-specific",
      maxTier: 3,
      prices: [150, 300, 500],
      effects: [
        { type: "preview", value: 10, minigame: "checksum-verify" },
        { type: "preview", value: 5, minigame: "checksum-verify" },
        { type: "preview", value: 3, minigame: "checksum-verify" },
      ],
    },
  ],
};
