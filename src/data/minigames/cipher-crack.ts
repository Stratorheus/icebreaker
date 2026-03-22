import { CipherCrack } from "@/components/minigames/CipherCrack";
import type { MinigameConfig } from "./types";

export const cipherCrackConfig: MinigameConfig = {
  id: "cipher-crack",
  displayName: "Cipher Crack V1",
  component: CipherCrack,
  baseTimeLimit: 12,
  starting: false,
  unlockPrice: 300,
  briefing: {
    rules: [
      "An encrypted word is shown \u2014 decode it by typing the plaintext",
      "The cipher method (letter-swap, vowel-removal, or scramble) is hinted on screen",
      "Type the decrypted word letter by letter; any mistake = failure",
      "Decode all letters to complete the breach",
    ],
    controls: {
      desktop: "Keyboard \u2014 type the decoded letters",
      touch: "System keyboard \u2014 type the decoded letters",
    },
    tips: [
      "Letter-swap: two letters in the word have been swapped \u2014 find them",
      "Vowel-removal: vowels are stripped \u2014 figure out the original word from consonants",
    ],
    hint: {
      desktop: "Decode the cipher to find the original word.",
      touch: "Reverse the letter shift to find the original word.",
    },
  },
  metaUpgrades: [
    {
      id: "cipher-hint",
      name: "Cipher Hint",
      description: "An extra cipher hint letter is shown in Cipher Crack V1.",
      category: "game-specific",
      maxTier: 1,
      prices: [225],
      effects: [{ type: "extra-hint", value: 1, minigame: "cipher-crack" }],
    },
    {
      id: "decode-assist",
      name: "Decode Assist",
      description: "Pre-fills 20/40/60% of decoded letters at their correct positions in Cipher Crack V1.",
      category: "game-specific",
      maxTier: 3,
      prices: [150, 300, 500],
      effects: [
        { type: "minigame-specific", value: 0.20, minigame: "cipher-crack" },
        { type: "minigame-specific", value: 0.40, minigame: "cipher-crack" },
        { type: "minigame-specific", value: 0.60, minigame: "cipher-crack" },
      ],
    },
  ],
};
