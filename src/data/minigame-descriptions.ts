import type { MinigameType } from "@/types/game";

// ---------------------------------------------------------------------------
// Single source of truth for all minigame descriptions, controls, tips, hints.
// Used by: Training.tsx, Codex.tsx, MinigameScreen.tsx (countdown hint)
// ---------------------------------------------------------------------------

export interface MinigameBriefing {
  rules: string[];
  controls: {
    desktop: string;
    touch: string;
  };
  tips: string[];
  hint: {
    desktop: string;
    touch: string;
  };
}

export const MINIGAME_BRIEFINGS: Record<MinigameType, MinigameBriefing> = {
  "slash-timing": {
    rules: [
      "Three phases cycle in sequence: GUARD → PREPARE → ATTACK",
      "Press SPACE only during the green ATTACK window to succeed",
      "Pressing SPACE during GUARD or PREPARE causes immediate failure",
      "Missing the ATTACK window restarts the cycle — keep waiting",
    ],
    controls: {
      desktop: "SPACE — strike",
      touch: "TAP — strike",
    },
    tips: [
      "Watch for the PREPARE phase as your cue to get ready",
      "At higher difficulty the ATTACK window shrinks — precision matters",
    ],
    hint: {
      desktop: "Wait for the GREEN flash, then press Space.",
      touch: "Wait for the GREEN flash, then TAP.",
    },
  },
  "close-brackets": {
    rules: [
      "A sequence of opening brackets is displayed",
      "Type the matching closing brackets in REVERSE order (stack style)",
      "Bracket pairs: ( → )  [ → ]  { → }  < → >  | → |  \\ → /",
      "Any wrong key causes immediate failure",
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
  "type-backward": {
    rules: [
      "Mirrored (reversed) words are displayed in scrambled order",
      "Read each mirrored word and type the ORIGINAL word it represents",
      "Work through them left to right — any wrong key = immediate failure",
      "Decode and type all words to succeed",
    ],
    controls: {
      desktop: "Keyboard — type each letter of the original word",
      touch: "System keyboard — type each letter of the original word",
    },
    tips: [
      "Read the mirrored word backwards in your head to find the original",
      "Short words first — longer words appear at higher difficulty",
    ],
    hint: {
      desktop: "Read mirrored words, type the originals in order.",
      touch: "Read mirrored words, type the originals in order.",
    },
  },
  "match-arrows": {
    rules: [
      "A row of hidden arrow slots is shown — one is revealed at a time",
      "Press the matching arrow key to advance to the next slot",
      "Wrong arrow key = immediate failure",
      "Match all arrows in sequence to complete",
    ],
    controls: {
      desktop: "Arrow keys: ↑ ↓ ← →",
      touch: "Use the D-pad buttons below",
    },
    tips: [
      "Focus on each revealed arrow one at a time, not the full row",
      "At higher difficulty the row gets longer — stay calm and methodical",
    ],
    hint: {
      desktop: "Press the arrow key that matches the revealed arrow.",
      touch: "Tap the D-pad direction that matches the revealed arrow.",
    },
  },
  "find-symbol": {
    rules: [
      "A target sequence is shown at the top of the screen",
      "Find and select the current target symbol in the grid below",
      "Match all targets in order to complete — wrong pick = failure",
    ],
    controls: {
      desktop: "Arrow keys + ENTER to navigate, or click with mouse",
      touch: "TAP the matching hex code in the grid",
    },
    tips: [
      "At higher difficulty visually similar symbols are mixed in — look carefully",
      "Use the cursor highlight to track your grid position with keyboard",
    ],
    hint: {
      desktop: "Click/select each target symbol in order.",
      touch: "TAP each target symbol in order.",
    },
  },
  "mine-sweep": {
    rules: [
      "Corrupted sectors are revealed briefly in a PREVIEW phase — memorise their locations",
      "Sectors hide during the MARK phase — mark the cells you memorised",
      "Marking exactly the correct cells wins; any wrong mark = failure",
      "The grid auto-checks when you've marked the same count as corrupted sectors",
    ],
    controls: {
      desktop: "Arrow keys + SPACE to mark, or click cells",
      touch: "TAP to mark corrupted sectors",
    },
    tips: [
      "Group corrupted sectors by row or region in your mind during preview",
      "Higher difficulty = more corrupted sectors, smaller preview window — act fast",
    ],
    hint: {
      desktop: "Memorize corrupted sector positions during the preview phase.",
      touch: "Memorize corrupted sector positions during the preview phase.",
    },
  },
  "wire-cutting": {
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
      "Some wires are marked DO NOT CUT — leave those alone",
      "Work out the full order mentally before making the first cut",
    ],
    hint: {
      desktop: "Cut wires in the order shown by the sequence.",
      touch: "Cut wires in the order shown by the sequence.",
    },
  },
  "cipher-crack": {
    rules: [
      "An encrypted word is shown — decode it by typing the plaintext",
      "The cipher method (letter-swap, vowel-removal, or scramble) is hinted on screen",
      "Type the decrypted word letter by letter; any mistake = failure",
      "Decode all letters to complete the breach",
    ],
    controls: {
      desktop: "Keyboard — type the decoded letters",
      touch: "System keyboard — type the decoded letters",
    },
    tips: [
      "Letter-swap: two letters in the word have been swapped — find them",
      "Vowel-removal: vowels are stripped — figure out the original word from consonants",
    ],
    hint: {
      desktop: "Decode the cipher to find the original word.",
      touch: "Reverse the letter shift to find the original word.",
    },
  },
  "defrag": {
    rules: [
      "Grid of hidden cells — some contain mines",
      "Uncover cells to reveal numbers (count of adjacent mines)",
      "Cells with 0 adjacent mines auto-expand in a flood fill",
      "Uncover all safe cells to win — hitting a mine = fail",
    ],
    controls: {
      desktop: "Arrow keys to move, SPACE to uncover, ENTER to flag. Mouse: L-click uncover, R-click flag",
      touch: "TAP to uncover (toggle FLAG mode for flagging)",
    },
    tips: [
      "Use numbers to deduce mine positions — flag suspected mines",
      "Start near the center for better odds of hitting a 0-cell cascade",
    ],
    hint: {
      desktop: "Uncover cells, avoid mines. Numbers show adjacent mine count.",
      touch: "Tap cells to uncover, avoid mines. Numbers = adjacent mine count.",
    },
  },
  "network-trace": {
    rules: [
      "A maze is generated — navigate from entry point to target server",
      "Use arrow keys to move through open paths",
      "Walls block movement — find the correct route through the maze",
      "Reach the target server (◎) to succeed — fail only by timeout",
    ],
    controls: {
      desktop: "Arrow keys to move through the maze",
      touch: "Use the D-pad buttons to navigate the maze",
    },
    tips: [
      "Stick to one wall (left or right) and follow it — it always leads to the exit",
      "Larger mazes at higher difficulty — move quickly and stay oriented",
    ],
    hint: {
      desktop: "Navigate the maze from entry to target using arrow keys.",
      touch: "Navigate the maze from entry to target using the D-pad.",
    },
  },
  "signal-echo": {
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
  "checksum-verify": {
    rules: [
      "A series of math expressions is displayed one at a time",
      "Type the correct answer using number keys (0-9) and minus (-)",
      "Press ENTER or SPACE to confirm — wrong answer = immediate failure",
      "Solve all expressions to verify the data integrity",
    ],
    controls: {
      desktop: "Number keys (0-9), minus (-), Backspace, ENTER/SPACE to confirm",
      touch: "Number pad — type answer, TAP CONFIRM to submit",
    },
    tips: [
      "At low difficulty it's simple addition/subtraction — stay calm",
      "Higher difficulty adds two-digit math and multiplication up to 9x9",
    ],
    hint: {
      desktop: "Solve each math expression — type the answer and press Enter.",
      touch: "Solve each math expression — type the answer and tap CONFIRM.",
    },
  },
  "port-scan": {
    rules: [
      "A grid of port numbers is displayed — open ports flash green one by one",
      "Memorize which ports flash during the display phase (timer paused)",
      "After display, select all open ports — selecting a wrong port = immediate failure",
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
  "subnet-scan": {
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
  "cipher-crack-v2": {
    rules: [
      "An encrypted word is shown — it uses only ROT ciphers",
      "An alphabet reference chart is always displayed for decoding",
      "Find the encrypted letter on the bottom row, read the original above",
      "Type the decrypted word letter by letter; any mistake = failure",
    ],
    controls: {
      desktop: "Keyboard — type the decoded letters",
      touch: "System keyboard — type the decoded letters",
    },
    tips: [
      "At low difficulty it's a simple ROT shift — each letter moves the same amount",
      "At higher difficulty the word is reversed before shifting — decode then un-reverse",
    ],
    hint: {
      desktop: "Use the alphabet chart to decode the ROT cipher.",
      touch: "Use the alphabet chart to decode the ROT cipher.",
    },
  },
};

/** Get the brief hint for a minigame (used during countdown when Hint Module is active). */
export function getMinigameHint(type: MinigameType, isTouch: boolean): string {
  const briefing = MINIGAME_BRIEFINGS[type];
  return isTouch ? briefing.hint.touch : briefing.hint.desktop;
}