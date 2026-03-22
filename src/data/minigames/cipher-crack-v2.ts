import { CipherCrackV2 } from "@/components/minigames/CipherCrackV2";
import type { MinigameConfig } from "./types";

export const cipherCrackV2Config: MinigameConfig = {
  id: "cipher-crack-v2",
  displayName: "Cipher Crack V2",
  component: CipherCrackV2,
  baseTimeLimit: 15,
  starting: false,
  unlockPrice: "dynamic",
  requires: "cipher-crack-license",
  briefing: {
    rules: [
      "An encrypted word is shown \u2014 it uses only ROT ciphers",
      "An alphabet reference chart is always displayed for decoding",
      "Find the encrypted letter on the bottom row, read the original above",
      "Type the decrypted word letter by letter; any mistake = failure",
    ],
    controls: {
      desktop: "Keyboard \u2014 type the decoded letters",
      touch: "System keyboard \u2014 type the decoded letters",
    },
    tips: [
      "At low difficulty it's a simple ROT shift \u2014 each letter moves the same amount",
      "At higher difficulty the word is reversed before shifting \u2014 decode then un-reverse",
    ],
    hint: {
      desktop: "Use the alphabet chart to decode the ROT cipher.",
      touch: "Use the alphabet chart to decode the ROT cipher.",
    },
  },
  metaUpgrades: [
    {
      id: "shift-marker",
      name: "Shift Marker",
      description: "Highlights the ROT shift amount in the alphabet chart in Cipher Crack V2.",
      category: "game-specific",
      maxTier: 1,
      prices: [175],
      effects: [{ type: "minigame-specific", value: 1, minigame: "cipher-crack-v2" }],
    },
    {
      id: "auto-decode-v2",
      name: "Auto-Decode",
      description: "Pre-fills 20/40/60% of decoded letters in Cipher Crack V2.",
      category: "game-specific",
      maxTier: 3,
      prices: [200, 400, 650],
      effects: [
        { type: "hint", value: 0.20, minigame: "cipher-crack-v2" },
        { type: "hint", value: 0.40, minigame: "cipher-crack-v2" },
        { type: "hint", value: 0.60, minigame: "cipher-crack-v2" },
      ],
    },
  ],
};
