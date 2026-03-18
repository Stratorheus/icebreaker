import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

// ── Wire colors ──────────────────────────────────────────────────────

const ALL_COLORS = [
  "RED",
  "BLUE",
  "GREEN",
  "YELLOW",
  "PURPLE",
  "ORANGE",
  "WHITE",
  "CYAN",
] as const;

type WireColor = (typeof ALL_COLORS)[number];

/** CSS color value for each wire */
const COLOR_CSS: Record<WireColor, string> = {
  RED: "#ff3333",
  BLUE: "#3388ff",
  GREEN: "#33ff66",
  YELLOW: "#ffee33",
  PURPLE: "#bb44ff",
  ORANGE: "#ff8833",
  WHITE: "#eeeeff",
  CYAN: "#00ffff",
};

// ── Rule types ───────────────────────────────────────────────────────

interface Rule {
  text: string;
}

interface Puzzle {
  /** Wire colors in display order (position 1..N) */
  wires: WireColor[];
  /** The correct sequence of wire indices (0-based) to cut */
  correctOrder: number[];
  /** Human-readable rules */
  rules: Rule[];
}

// ── Fisher-Yates shuffle ─────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Puzzle generation ────────────────────────────────────────────────

/**
 * Generate a puzzle: pick N random colors, build a valid ordering,
 * and express it as rules.
 *
 * Strategy:
 * 1. Pick N distinct colors, assign to wire positions 0..N-1
 * 2. Decide which wires to skip (0 at low difficulty, 0-1 at mid, 0-2 at high)
 * 3. Generate a random valid cut order for the non-skipped wires
 * 4. Express the order via rules that are unambiguous
 */
function generatePuzzle(wireCount: number, difficulty: number): Puzzle {
  // Pick N distinct random colors
  const colorPool = shuffle([...ALL_COLORS]);
  const wires = colorPool.slice(0, wireCount) as WireColor[];

  // Decide skip count: 0 at d<0.3, 0-1 at d<0.6, 0-1 at d>=0.6
  const maxSkips = difficulty < 0.3 ? 0 : difficulty < 0.7 ? 1 : Math.min(2, wireCount - 2);
  const skipCount = Math.min(maxSkips, Math.floor(Math.random() * (maxSkips + 1)));

  // Pick random wires to skip
  const allIndices = wires.map((_, i) => i);
  const shuffledIndices = shuffle(allIndices);
  const skippedIndices = new Set(shuffledIndices.slice(0, skipCount));

  // The cuttable wires (in random cut order)
  const cuttable = shuffledIndices.filter((i) => !skippedIndices.has(i));
  // Shuffle cuttable to get the correct cut order
  const correctOrder = shuffle(cuttable);

  // Generate rules that express this order unambiguously
  const rules = buildRules(wires, correctOrder, skippedIndices, difficulty);

  return { wires, correctOrder, rules };
}

/**
 * Build rules that uniquely determine the correct cut order.
 *
 * At low difficulty (1-2 rules): simple "cut X first", "cut X last", "cut X before Y"
 * At high difficulty (3-4 rules): more rules including skips and relative ordering
 */
function buildRules(
  wires: WireColor[],
  correctOrder: number[],
  skippedIndices: Set<number>,
  difficulty: number,
): Rule[] {
  const rules: Rule[] = [];

  // Add skip rules first
  for (const idx of skippedIndices) {
    rules.push({ text: `Skip ${wires[idx]}` });
  }

  const orderLength = correctOrder.length;

  if (orderLength === 0) return rules;

  // Target rule count (excluding skip rules)
  const targetRuleCount =
    difficulty < 0.3
      ? Math.min(2, orderLength)
      : difficulty < 0.6
        ? Math.min(3, orderLength)
        : Math.min(4, orderLength);

  // Strategy: express ordering via a combination of:
  // - "Cut X first"
  // - "Cut X last"
  // - "Cut X before Y"
  // - "Cut wires in alphabetical order" (by color name) — only if it matches
  // - Positional: "Cut X second", "Cut X third", etc.

  const positionLabels = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
  ];

  // Check if alphabetical order matches
  const alphabeticalOrder = [...correctOrder].sort((a, b) =>
    wires[a].localeCompare(wires[b]),
  );
  const isAlphabetical =
    alphabeticalOrder.every((v, i) => v === correctOrder[i]) &&
    orderLength >= 3;

  if (isAlphabetical && difficulty >= 0.5 && Math.random() < 0.4) {
    // Use the compact "alphabetical order" rule
    rules.push({ text: "Cut wires in alphabetical order" });
    return rules;
  }

  // Build a set of rules that fully determine the order
  const ruleSet: Rule[] = [];

  // Always state the first wire
  ruleSet.push({
    text: `Cut ${wires[correctOrder[0]]} first`,
  });

  // If more than 2, state the last wire
  if (orderLength >= 2) {
    ruleSet.push({
      text: `Cut ${wires[correctOrder[orderLength - 1]]} last`,
    });
  }

  // Add relative ordering for middle wires
  for (let i = 1; i < orderLength - 1; i++) {
    // Alternate between "before" rules and positional rules
    if (Math.random() < 0.5 || difficulty < 0.4) {
      ruleSet.push({
        text: `Cut ${wires[correctOrder[i]]} before ${wires[correctOrder[i + 1]]}`,
      });
    } else {
      ruleSet.push({
        text: `Cut ${wires[correctOrder[i]]} ${positionLabels[i] ?? `at position ${i + 1}`}`,
      });
    }
  }

  // Select rules to meet target count while ensuring determinism
  // Always include the "first" rule
  const selectedRules: Rule[] = [ruleSet[0]];
  const remainingRules = ruleSet.slice(1);

  // We need enough rules to fully determine the order
  // "first" + "last" + enough middle constraints = full determination
  // For N cuttable wires, we need N-1 constraints minimum
  // But we want to stay near targetRuleCount for aesthetics

  // Add remaining rules up to the needed count
  const neededCount = Math.max(targetRuleCount, orderLength - 1);
  for (let i = 0; i < Math.min(neededCount - 1, remainingRules.length); i++) {
    selectedRules.push(remainingRules[i]);
  }

  // If we still don't have enough constraints, add explicit positional rules
  // for any wire not yet constrained
  const constrainedWires = new Set<number>();
  for (const rule of selectedRules) {
    for (let i = 0; i < correctOrder.length; i++) {
      if (rule.text.includes(wires[correctOrder[i]])) {
        constrainedWires.add(i);
      }
    }
  }

  for (let i = 0; i < correctOrder.length; i++) {
    if (!constrainedWires.has(i)) {
      const label = positionLabels[i] ?? `at position ${i + 1}`;
      selectedRules.push({
        text: `Cut ${wires[correctOrder[i]]} ${label}`,
      });
    }
  }

  // Shuffle rules for presentation (except skip rules stay at top)
  rules.push(...shuffle(selectedRules));
  return rules;
}

// ── Component ────────────────────────────────────────────────────────

/**
 * WireCutting — rule-based deduction minigame.
 *
 * Displays N colored wires (numbered 1-N) and a set of rules.
 * The player must cut wires in the correct order by pressing number keys.
 *
 * Wrong key = immediate fail. All correct cuts = success.
 */
export function WireCutting(props: MinigameProps) {
  const { difficulty } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "wire-cutting",
    props,
  );

  const resolvedRef = useRef(false);

  // Wire count: 3 (d=0) → 7 (d=1)
  const wireCount = Math.round(3 + difficulty * 4);

  // Generate puzzle on mount
  const puzzle = useMemo(() => {
    return generatePuzzle(wireCount, difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Current position in the correct cut order
  const [cutIndex, setCutIndex] = useState(0);
  const cutIndexRef = useRef(0);

  // Track which wires have been cut (by wire index)
  const [cutWires, setCutWires] = useState<Set<number>>(new Set());

  // Sync ref with state
  useEffect(() => {
    cutIndexRef.current = cutIndex;
  }, [cutIndex]);

  const handleNumberPress = useCallback(
    (wireNumber: number) => {
      if (!isActive || resolvedRef.current) return;

      // wireNumber is 1-based, convert to 0-based index
      const wireIndex = wireNumber - 1;

      // Ignore if wire doesn't exist
      if (wireIndex < 0 || wireIndex >= puzzle.wires.length) return;

      // Ignore if already cut
      if (cutWires.has(wireIndex)) return;

      const idx = cutIndexRef.current;
      const expected = puzzle.correctOrder[idx];

      if (wireIndex === expected) {
        // Correct cut
        const nextIndex = idx + 1;
        setCutIndex(nextIndex);
        setCutWires((prev) => new Set(prev).add(wireIndex));

        if (nextIndex >= puzzle.correctOrder.length) {
          // All wires cut in correct order — success
          resolvedRef.current = true;
          complete(true);
        }
      } else {
        // Wrong wire — immediate fail
        resolvedRef.current = true;
        fail();
      }
    },
    [isActive, puzzle, cutWires, complete, fail],
  );

  // Build key map for number keys 1-9
  const keyMap = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (let i = 1; i <= 9; i++) {
      const num = i;
      map[String(i)] = () => handleNumberPress(num);
    }
    return map;
  }, [handleNumberPress]);

  useKeyboard(keyMap);

  // The next wire to cut (for highlighting)
  const nextWireIndex =
    cutIndex < puzzle.correctOrder.length ? puzzle.correctOrder[cutIndex] : -1;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-6" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-2xl">
        {/* Rules panel */}
        <div className="text-center w-full max-w-md">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
            Instructions
          </p>
          <div className="flex flex-col gap-1.5 px-4 py-3 border border-white/10 rounded-lg bg-white/5">
            {puzzle.rules.map((rule, i) => (
              <p
                key={i}
                className="text-sm font-mono text-cyber-cyan leading-relaxed"
              >
                <span className="text-white/40 mr-2">{`>`}</span>
                {rule.text}
              </p>
            ))}
          </div>
        </div>

        {/* Progress */}
        <p className="text-white/40 text-xs uppercase tracking-widest">
          {cutIndex}/{puzzle.correctOrder.length} wires cut
        </p>

        {/* Wires display */}
        <div className="flex items-end justify-center gap-3 sm:gap-4">
          {puzzle.wires.map((color, i) => {
            const isCut = cutWires.has(i);
            const isNext = i === nextWireIndex;
            const isSkipped = !puzzle.correctOrder.includes(i);
            const wireColor = COLOR_CSS[color];

            return (
              <div
                key={i}
                className="flex flex-col items-center gap-2 cursor-pointer"
                onClick={() => handleNumberPress(i + 1)}
              >
                {/* Wire number label */}
                <span
                  className={`
                    text-xs font-mono font-bold
                    ${isCut ? "text-white/20" : isNext ? "text-cyber-green" : "text-white/60"}
                  `}
                >
                  {i + 1}
                </span>

                {/* Wire visual */}
                <div
                  className={`
                    relative flex items-center justify-center
                    w-8 sm:w-10 rounded-sm
                    transition-all duration-200
                    ${isCut ? "opacity-25" : isNext ? "opacity-100" : "opacity-80"}
                  `}
                  style={{ height: "140px" }}
                >
                  {/* Wire body */}
                  <div
                    className={`
                      w-3 sm:w-4 h-full rounded-sm
                      transition-all duration-200
                      ${isNext && !isCut ? "shadow-[0_0_16px_var(--glow)]" : ""}
                    `}
                    style={
                      {
                        backgroundColor: isCut ? "#333" : wireColor,
                        "--glow": wireColor,
                      } as React.CSSProperties
                    }
                  />

                  {/* Cut line overlay */}
                  {isCut && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-white/40 rotate-12" />
                    </div>
                  )}

                  {/* Pulse ring for next wire */}
                  {isNext && !isCut && (
                    <div
                      className="absolute inset-0 rounded-sm border-2 animate-pulse"
                      style={{ borderColor: wireColor }}
                    />
                  )}
                </div>

                {/* Color label */}
                <span
                  className={`
                    text-[10px] font-mono font-bold uppercase tracking-wide
                    ${isCut ? "text-white/20 line-through" : isSkipped ? "text-white/30" : "text-white/70"}
                  `}
                  style={!isCut ? { color: wireColor } : undefined}
                >
                  {color}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key hints */}
      <div className="mt-6 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          Press the wire number to cut
        </p>
        <div className="inline-flex items-center gap-1.5 px-4 py-2 border border-white/10 rounded-lg bg-white/5">
          {puzzle.wires.map((_, i) => (
            <kbd
              key={i}
              className={`
                px-2 py-1 rounded text-xs font-bold font-mono
                ${
                  cutWires.has(i)
                    ? "bg-white/5 text-white/20"
                    : i === nextWireIndex
                      ? "bg-cyber-green/20 text-cyber-green"
                      : "bg-white/10 text-white/70"
                }
              `}
            >
              {i + 1}
            </kbd>
          ))}
        </div>
      </div>
    </div>
  );
}
