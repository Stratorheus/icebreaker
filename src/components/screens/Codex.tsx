import { useState } from "react";
import { useGameStore } from "@/store/game-store";
import type { MinigameType } from "@/types/game";
import { UNLOCKABLE_MINIGAMES } from "@/types/game";

// ---------------------------------------------------------------------------
// Briefing data (mirrors Training.tsx — kept in sync manually)
// ---------------------------------------------------------------------------

interface BriefingData {
  title: string;
  rules: string[];
  controls: string;
  tips: string[];
}

const BRIEFINGS: Record<MinigameType, BriefingData> = {
  "slash-timing": {
    title: "SLASH TIMING",
    rules: [
      "Three phases cycle in sequence: GUARD → PREPARE → ATTACK",
      "Press SPACE only during the green ATTACK window to succeed",
      "Pressing SPACE during GUARD or PREPARE causes immediate failure",
      "Missing the ATTACK window restarts the cycle — keep waiting",
    ],
    controls: "SPACE — strike",
    tips: [
      "Watch for the PREPARE phase as your cue to get ready",
      "At higher difficulty the ATTACK window shrinks — precision matters",
    ],
  },
  "close-brackets": {
    title: "CLOSE BRACKETS",
    rules: [
      "A sequence of opening brackets is displayed",
      "Type the matching closing brackets in REVERSE order (stack style)",
      "Bracket pairs: ( → )  [ → ]  { → }  < → >  | → |  \\ → /",
      "Any wrong key causes immediate failure",
    ],
    controls: "Keyboard keys: ) ] } > | /",
    tips: [
      "Read the opening sequence from right to left to find your first key",
      "Build muscle memory for each bracket pair before timed runs",
    ],
  },
  "type-backward": {
    title: "TYPE BACKWARD",
    rules: [
      "A word is shown on screen — type it in reverse letter by letter",
      "Only the letters of the reversed word are accepted",
      "Any incorrect key causes immediate failure",
      "Complete all letters to succeed",
    ],
    controls: "Keyboard — type each letter",
    tips: [
      "Say the word aloud in reverse before typing to lock in the order",
      "Short words first — longer words appear at higher difficulty",
    ],
  },
  "match-arrows": {
    title: "MATCH ARROWS",
    rules: [
      "A row of hidden arrow slots is shown — one is revealed at a time",
      "Press the matching arrow key to advance to the next slot",
      "Wrong arrow key = immediate failure",
      "Match all arrows in sequence to complete",
    ],
    controls: "Arrow keys: ↑ ↓ ← →",
    tips: [
      "Focus on each revealed arrow one at a time, not the full row",
      "At higher difficulty the row gets longer — stay calm and methodical",
    ],
  },
  "find-symbol": {
    title: "FIND SYMBOL",
    rules: [
      "A target sequence is shown at the top of the screen",
      "Find and select the current target symbol in the grid below",
      "Match all targets in order to complete — wrong pick = failure",
      "Both keyboard navigation and mouse click are supported",
    ],
    controls: "Arrow keys + ENTER to navigate, or click with mouse",
    tips: [
      "At higher difficulty visually similar symbols are mixed in — look carefully",
      "Use the cursor highlight to track your grid position with keyboard",
    ],
  },
  "mine-sweep": {
    title: "MINE SWEEP",
    rules: [
      "Mines are revealed briefly in a PREVIEW phase — memorise their locations",
      "Mines hide during the MARK phase — mark the cells you memorised",
      "Marking exactly the correct cells wins; any wrong mark = failure",
      "The grid auto-checks when you've marked the same count as mines",
    ],
    controls: "Arrow keys + SPACE to mark, or click cells",
    tips: [
      "Group mines by row or region in your mind during preview",
      "Higher difficulty = more mines, smaller preview window — act fast",
    ],
  },
  "wire-cutting": {
    title: "WIRE CUTTING",
    rules: [
      "A set of coloured wires and a rule panel are displayed",
      "Read the rules carefully to deduce the correct cutting order",
      "Press the number key matching a wire to cut it",
      "Wrong order = immediate failure; cut all required wires to succeed",
    ],
    controls: "Number keys 1–9 to cut wires, or click a wire",
    tips: [
      "Some wires may be SKIP — do not cut those at all",
      "Work out the full order on paper mentally before making the first cut",
    ],
  },
  "cipher-crack": {
    title: "CIPHER CRACK",
    rules: [
      "An encrypted word is shown — decode it by typing the plaintext",
      "The cipher method (ROT-N or substitution) is hinted on screen",
      "Type the decrypted word letter by letter; any mistake = failure",
      "Decode all letters to complete the breach",
    ],
    controls: "Keyboard — type the decoded letters",
    tips: [
      "ROT ciphers: shift each letter back by the stated amount",
      "Substitution: map each letter using the shown key table",
    ],
  },
  "defrag": {
    title: "DEFRAG",
    rules: [
      "Grid of hidden cells — some contain mines",
      "Uncover cells to reveal numbers (count of adjacent mines)",
      "Cells with 0 adjacent mines auto-expand in a flood fill",
      "Uncover all safe cells to win — hitting a mine = fail",
    ],
    controls: "Arrow keys to move, SPACE to uncover, ENTER to flag. Mouse: L-click uncover, R-click flag",
    tips: [
      "Use numbers to deduce mine positions — flag suspected mines",
      "Start near the center for better odds of hitting a 0-cell cascade",
    ],
  },
  "network-trace": {
    title: "NETWORK TRACE",
    rules: [
      "A maze is generated — navigate from entry point to target server",
      "Use arrow keys to move through open paths",
      "Walls block movement — find the correct route through the maze",
      "Reach the target server (◎) to succeed — fail only by timeout",
    ],
    controls: "Arrow keys to move through the maze",
    tips: [
      "Stick to one wall (left or right) and follow it — it always leads to the exit",
      "Larger mazes at higher difficulty — move quickly and stay oriented",
    ],
  },
  "data-stream": {
    title: "DATA STREAM",
    rules: [
      "Guide a snake (data stream) through the grid",
      "Visit all numbered nodes IN ORDER (1, 2, 3...)",
      "Fill EVERY cell in the grid — the snake grows with each step",
      "Cannot move into cells already occupied by the snake body",
    ],
    controls: "Arrow keys = move, Reverse direction = undo, SPACE = reset puzzle",
    tips: [
      "Moving opposite to your last direction retracts the head (free undo)",
      "Larger grids and more nodes at higher difficulty — plan your route carefully",
    ],
  },
  "signal-echo": {
    title: "SIGNAL ECHO",
    rules: [
      "4 colored panels (Up=Cyan, Right=Magenta, Down=Green, Left=Orange)",
      "Watch the sequence light up, then repeat it with arrow keys or clicks",
      "Each successful round adds one more step to the sequence",
      "Any wrong input = immediate failure",
    ],
    controls: "Arrow keys or click the panels to repeat the sequence",
    tips: [
      "Verbalize the directions as the sequence plays (e.g. 'up, left, down...')",
      "Higher difficulty starts with longer sequences and faster display speed",
    ],
  },
  "checksum-verify": {
    title: "CHECKSUM VERIFY",
    rules: [
      "A series of math expressions is displayed one at a time",
      "Type the correct answer using number keys (0-9) and minus (-)",
      "Press ENTER or SPACE to confirm — wrong answer = immediate failure",
      "Solve all expressions to verify the data integrity",
    ],
    controls: "Number keys (0-9), minus (-), Backspace, ENTER/SPACE to confirm",
    tips: [
      "At low difficulty it's simple addition/subtraction — stay calm",
      "Higher difficulty adds two-digit math and multiplication up to 9x9",
    ],
  },
  "port-scan": {
    title: "PORT SCAN",
    rules: [
      "A grid of port numbers is displayed — open ports flash green one by one",
      "Memorize which ports flash during the display phase (timer paused)",
      "After display, select all open ports — selecting a wrong port = immediate failure",
      "All correct selections = success; timer runs during the select phase",
    ],
    controls: "Arrow keys to navigate, SPACE to toggle select, or click with mouse",
    tips: [
      "Group open ports by position during the display phase",
      "Higher difficulty increases grid size and the number of open ports",
    ],
  },
  "subnet-scan": {
    title: "SUBNET SCAN",
    rules: [
      "An IP range (CIDR notation) is displayed at the top",
      "A list of IP addresses is shown below the range",
      "Select all addresses that belong to the displayed subnet",
      "Wrong selection = immediate failure; all correct = success",
    ],
    controls: "Arrow keys to navigate, SPACE to toggle, or click",
    tips: [
      "/24 = first 3 numbers must match, /16 = first 2, /8 = first 1",
      "A help box at the bottom explains the current subnet mask",
    ],
  },
  "cipher-crack-v2": {
    title: "CIPHER CRACK V2",
    rules: [
      "An advanced multi-layer cipher is applied to the plaintext",
      "Decode each layer in sequence — substitution, then transposition",
      "Type the fully decoded word letter by letter",
      "Any mistake at any layer = immediate failure",
    ],
    controls: "Keyboard — type the decoded letters",
    tips: [
      "Solve the outermost cipher layer first, then work inward",
      "The hint panel shows which cipher methods are stacked",
    ],
  },
};

const ALL_MINIGAMES: MinigameType[] = [
  "slash-timing",
  "close-brackets",
  "type-backward",
  "match-arrows",
  "mine-sweep",
  "find-symbol",
  "wire-cutting",
  "cipher-crack",
  "defrag",
  "network-trace",
  "data-stream",
  "signal-echo",
  "checksum-verify",
  "port-scan",
  "subnet-scan",
  "cipher-crack-v2",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UnlockedEntry({
  type,
  briefing,
  expanded,
  onToggle,
}: {
  type: MinigameType;
  briefing: BriefingData;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.02]">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="
          w-full flex items-center justify-between
          px-4 py-3
          text-left cursor-pointer select-none
          hover:bg-white/[0.03] transition-colors duration-100
        "
      >
        <div className="flex items-center gap-3">
          <span className="text-cyber-cyan text-[10px] select-none">{">"}</span>
          <span className="text-cyber-cyan text-sm font-bold uppercase tracking-wider glitch-text">
            {briefing.title}
          </span>
          <span className="text-white/20 text-[10px] uppercase tracking-widest hidden sm:inline">
            {type}
          </span>
        </div>
        <span className="text-white/30 text-xs select-none">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5">
          {/* Rules */}
          <section className="pt-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2">
              PROTOCOL RULES
            </h3>
            <ul className="space-y-1.5">
              {briefing.rules.map((rule, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-white/60 leading-relaxed"
                >
                  <span className="text-cyber-cyan/50 shrink-0 select-none">{">"}</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Controls */}
          <section className="border border-cyber-cyan/15 bg-cyber-cyan/[0.02] px-3 py-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyber-cyan/40 mb-1.5">
              CONTROLS
            </h3>
            <p className="text-cyber-cyan/80 text-sm font-mono">{briefing.controls}</p>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2">
              TACTICAL TIPS
            </h3>
            <ul className="space-y-1.5">
              {briefing.tips.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-white/40 leading-relaxed"
                >
                  <span className="text-cyber-magenta/50 shrink-0 select-none">◆</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function LockedEntry({ type }: { type: MinigameType }) {
  return (
    <div className="border border-white/5 bg-white/[0.01] px-4 py-3 flex items-center gap-3 opacity-40">
      <span className="text-white/20 text-[10px] select-none">{">"}</span>
      <span className="text-white/30 text-sm font-bold uppercase tracking-wider">???</span>
      <span className="text-white/15 text-[10px] uppercase tracking-widest ml-2">
        UNLOCK IN META SHOP
      </span>
      <span className="ml-auto text-white/15 text-[10px] uppercase tracking-widest hidden sm:inline">
        {type}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Codex screen
// ---------------------------------------------------------------------------

export function Codex({ onBack }: { onBack?: () => void } = {}) {
  const setStatus = useGameStore((s) => s.setStatus);
  const unlockedMinigames = useGameStore((s) => s.unlockedMinigames);
  const handleBack = onBack ?? (() => setStatus("menu"));

  const unlockedSet = new Set(unlockedMinigames);
  const unlockedCount = unlockedMinigames.length;
  const totalCount = ALL_MINIGAMES.length;

  // Track which entries are expanded (default: first unlocked entry open)
  const firstUnlocked = ALL_MINIGAMES.find((t) => unlockedSet.has(t));
  const [expanded, setExpanded] = useState<Set<MinigameType>>(
    new Set(firstUnlocked ? [firstUnlocked] : []),
  );

  const toggle = (type: MinigameType) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-12 pb-16 overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-1 glitch-flicker">
          {">"}_&nbsp;REFERENCE ARCHIVE
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan glitch-text">
          OPERATION MANUAL
        </h1>
        <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1 glitch-subtle">
          CODEX — MINIGAME PROTOCOLS
        </p>
      </div>

      {/* Progress indicator */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-white/30 text-[10px] uppercase tracking-widest glitch-subtle">
            PROTOCOLS LICENSED
          </span>
          <span className="text-cyber-cyan/60 text-xs font-mono tabular-nums">
            {unlockedCount} / {totalCount}
          </span>
        </div>
        <div className="h-1 w-full bg-white/10">
          <div
            className="h-full bg-cyber-cyan/50 transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Entries */}
      <div className="w-full max-w-2xl space-y-2 mb-8">
        {ALL_MINIGAMES.map((type) =>
          unlockedSet.has(type) ? (
            <UnlockedEntry
              key={type}
              type={type}
              briefing={BRIEFINGS[type]}
              expanded={expanded.has(type)}
              onToggle={() => toggle(type)}
            />
          ) : UNLOCKABLE_MINIGAMES.includes(type) ? (
            <LockedEntry key={type} type={type} />
          ) : null,
        )}
      </div>

      {/* Unlock hint — only show if some are locked and not in pause context */}
      {unlockedCount < totalCount && !onBack && (
        <div className="w-full max-w-2xl border border-dashed border-white/10 px-4 py-3 mb-6 text-center">
          <p className="text-white/20 text-[10px] uppercase tracking-widest">
            Locked protocols can be purchased in the{" "}
            <button
              type="button"
              onClick={() => setStatus("meta-shop")}
              className="text-cyber-cyan/40 hover:text-cyber-cyan/70 transition-colors cursor-pointer underline underline-offset-2"
            >
              META SHOP
            </button>
          </p>
        </div>
      )}

      {/* Back button */}
      <div className="w-full max-w-2xl">
        <button
          type="button"
          onClick={handleBack}
          className="
            py-2 px-6
            text-sm uppercase tracking-widest font-mono
            border border-white/15 text-white/40
            hover:bg-white/5 hover:text-white/70 hover:border-white/30
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          {">"}_&nbsp;{onBack ? "BACK TO VENDOR" : "BACK TO MENU"}
        </button>
      </div>
    </div>
  );
}
