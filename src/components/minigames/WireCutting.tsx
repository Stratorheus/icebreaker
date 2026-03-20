import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

// -- Wire colors ---------------------------------------------------------------

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

// -- Rule types ----------------------------------------------------------------

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

// -- Fisher-Yates shuffle ------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -- Puzzle generation ---------------------------------------------------------

/**
 * Generate a puzzle: pick N random colors, build a valid ordering,
 * and express it as rules.
 */
function generatePuzzle(wireCount: number, difficulty: number): Puzzle {
  const colorPool = shuffle([...ALL_COLORS]);
  const wires = colorPool.slice(0, wireCount) as WireColor[];

  const maxSkips = difficulty < 0.3 ? 0 : difficulty < 0.7 ? 1 : Math.min(2, wireCount - 2);
  const skipCount = Math.min(maxSkips, Math.floor(Math.random() * (maxSkips + 1)));

  const allIndices = wires.map((_, i) => i);
  const shuffledIndices = shuffle(allIndices);
  const skippedIndices = new Set(shuffledIndices.slice(0, skipCount));

  const cuttable = shuffledIndices.filter((i) => !skippedIndices.has(i));
  const correctOrder = shuffle(cuttable);

  const rules = buildRules(wires, correctOrder, skippedIndices, difficulty);

  return { wires, correctOrder, rules };
}

function buildRules(
  wires: WireColor[],
  correctOrder: number[],
  skippedIndices: Set<number>,
  difficulty: number,
): Rule[] {
  const rules: Rule[] = [];

  for (const idx of skippedIndices) {
    rules.push({ text: `DO NOT CUT ${wires[idx]}` });
  }

  const orderLength = correctOrder.length;
  if (orderLength === 0) return rules;

  const targetRuleCount =
    difficulty < 0.3
      ? Math.min(2, orderLength)
      : difficulty < 0.6
        ? Math.min(3, orderLength)
        : Math.min(4, orderLength);

  const positionLabels = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
  ];

  const alphabeticalOrder = [...correctOrder].sort((a, b) =>
    wires[a].localeCompare(wires[b]),
  );
  const isAlphabetical =
    alphabeticalOrder.every((v, i) => v === correctOrder[i]) &&
    orderLength >= 3;

  if (isAlphabetical && difficulty >= 0.5 && Math.random() < 0.4) {
    rules.push({ text: "Cut wires in alphabetical order" });
    return rules;
  }

  const ruleSet: Rule[] = [];

  ruleSet.push({
    text: `Cut ${wires[correctOrder[0]]} first`,
  });

  if (orderLength >= 2) {
    ruleSet.push({
      text: `Cut ${wires[correctOrder[orderLength - 1]]} last`,
    });
  }

  for (let i = 1; i < orderLength - 1; i++) {
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

  const selectedRules: Rule[] = [ruleSet[0]];
  const remainingRules = ruleSet.slice(1);

  const neededCount = Math.max(targetRuleCount, orderLength - 1);
  for (let i = 0; i < Math.min(neededCount - 1, remainingRules.length); i++) {
    selectedRules.push(remainingRules[i]);
  }

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

  rules.push(...shuffle(selectedRules));
  return rules;
}

// -- Component -----------------------------------------------------------------

/**
 * WireCutting -- rule-based deduction minigame (redesigned).
 *
 * Displays N colored wires and a set of rules. The player must read
 * the rules and deduce the correct cut order. No default highlighting
 * of the next wire — that's a meta upgrade.
 *
 * Wrong key = immediate fail. All correct cuts = success.
 */
export function WireCutting(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "wire-cutting",
    props,
  );

  const resolvedRef = useRef(false);

  // Check if player has the "wire order hint" meta upgrade
  const hasWireOrderHint = useMemo(() => {
    return activePowerUps.some(
      (p) => p.effect.type === "hint" && p.effect.minigame === "wire-cutting",
    );
  }, [activePowerUps]);

  // Wire count: 3 (d=0) -> 7 (d=1)
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

      const wireIndex = wireNumber - 1;

      if (wireIndex < 0 || wireIndex >= puzzle.wires.length) return;
      if (cutWires.has(wireIndex)) return;

      const idx = cutIndexRef.current;
      const expected = puzzle.correctOrder[idx];

      if (wireIndex === expected) {
        const nextIndex = idx + 1;
        setCutIndex(nextIndex);
        setCutWires((prev) => new Set(prev).add(wireIndex));

        if (nextIndex >= puzzle.correctOrder.length) {
          resolvedRef.current = true;
          complete(true);
        }
      } else {
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

  // The next wire to cut (for conditional highlighting)
  const nextWireIndex =
    cutIndex < puzzle.correctOrder.length ? puzzle.correctOrder[cutIndex] : -1;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-6" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-2xl">
        {/* Rules panel -- cleaner styling */}
        <div className="w-full max-w-md">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3 text-center">
            Instructions
          </p>
          <div className="flex flex-col gap-2 px-5 py-4 border border-white/15 rounded-lg bg-white/[0.03]">
            {puzzle.rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-white/30 font-mono text-sm mt-px shrink-0">{`${i + 1}.`}</span>
                <p className="text-sm font-mono text-cyber-cyan leading-relaxed">
                  {rule.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress */}
        <p className="text-white/40 text-xs uppercase tracking-widest">
          CUT {cutIndex} OF {puzzle.correctOrder.length} WIRES
          <span className="text-white/25 ml-2">({puzzle.wires.length} total)</span>
        </p>

        {/* Wires display -- cleaner design */}
        <div className="flex items-end justify-center gap-4 sm:gap-5">
          {puzzle.wires.map((color, i) => {
            const isCut = cutWires.has(i);
            const isNext = hasWireOrderHint && i === nextWireIndex;
            const wireColor = COLOR_CSS[color];

            return (
              <div
                key={i}
                className="flex flex-col items-center gap-2 cursor-pointer group"
                onClick={() => handleNumberPress(i + 1)}
              >
                {/* Wire number */}
                <span
                  className={`
                    text-xs font-mono font-bold transition-colors duration-200
                    ${isCut ? "text-white/20" : isNext ? "text-cyber-green" : "text-white/50 group-hover:text-white/80"}
                  `}
                >
                  {i + 1}
                </span>

                {/* Wire body */}
                <div
                  className="relative flex items-center justify-center w-8 sm:w-10 rounded-sm transition-all duration-200"
                  style={{ height: "120px" }}
                >
                  {/* Wire bar */}
                  <div
                    className={`
                      w-3 sm:w-4 h-full rounded-sm transition-all duration-200
                      ${!isCut ? "group-hover:shadow-[0_0_12px_var(--glow)]" : ""}
                      ${isNext ? "shadow-[0_0_16px_var(--glow)]" : ""}
                    `}
                    style={
                      {
                        backgroundColor: isCut ? "#222" : wireColor,
                        "--glow": wireColor,
                        opacity: isCut ? 0.3 : 1,
                      } as React.CSSProperties
                    }
                  />

                  {/* Cut line overlay */}
                  {isCut && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-white/30 rotate-12" />
                    </div>
                  )}

                  {/* Pulse ring for next wire -- ONLY with meta upgrade */}
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
                    text-[10px] font-mono font-bold uppercase tracking-wide transition-colors duration-200
                    ${isCut ? "text-white/20 line-through" : ""}
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
        <p className="desktop-only text-white/40 text-xs uppercase tracking-widest mb-2">
          Press the wire number to cut
        </p>
        <p className="touch-only text-white/40 text-xs uppercase tracking-widest mb-2">
          Tap a wire to cut
        </p>
        <div className="desktop-only inline-flex items-center gap-1.5 px-4 py-2 border border-white/10 rounded-lg bg-white/5">
          {puzzle.wires.map((_, i) => (
            <kbd
              key={i}
              className={`
                px-2 py-1 rounded text-xs font-bold font-mono transition-colors duration-200
                ${
                  cutWires.has(i)
                    ? "bg-white/5 text-white/20"
                    : hasWireOrderHint && i === nextWireIndex
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
