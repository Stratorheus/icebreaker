import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

// -- Stream colors -------------------------------------------------------------

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

/** CSS color value for each stream */
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

// -- Rain config ---------------------------------------------------------------

const COL_POSITIONS = [0, 6, 12] as const;
const CHARS_PER_COL = 9;
const HEX_CHARS = "0123456789ABCDEF";
const randomHex = () =>
  HEX_CHARS[Math.floor(Math.random() * 16)] +
  HEX_CHARS[Math.floor(Math.random() * 16)];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Pre-generate rain animation params for one stream */
function generateRainParams() {
  const params: { duration: number; delay: number; text: string }[] = [];
  for (let c = 0; c < COL_POSITIONS.length; c++) {
    for (let r = 0; r < CHARS_PER_COL; r++) {
      const duration = 1.6 + Math.random() * 1.4;
      const delay = Math.random() * duration;
      params.push({ duration, delay, text: randomHex() });
    }
  }
  return params;
}

// -- Rule types ----------------------------------------------------------------

interface Rule {
  text: string;
}

interface Puzzle {
  /** Stream colors in display order (position 1..N) */
  wires: WireColor[];
  /** The correct sequence of stream indices (0-based) to terminate */
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
    rules.push({ text: `DO NOT TERMINATE ${wires[idx]}` });
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
    rules.push({ text: "Terminate processes in alphabetical order" });
    return rules;
  }

  const ruleSet: Rule[] = [];

  ruleSet.push({
    text: `Terminate ${wires[correctOrder[0]]} first`,
  });

  if (orderLength >= 2) {
    ruleSet.push({
      text: `Terminate ${wires[correctOrder[orderLength - 1]]} last`,
    });
  }

  for (let i = 1; i < orderLength - 1; i++) {
    if (Math.random() < 0.5 || difficulty < 0.4) {
      ruleSet.push({
        text: `Terminate ${wires[correctOrder[i]]} before ${wires[correctOrder[i + 1]]}`,
      });
    } else {
      ruleSet.push({
        text: `Terminate ${wires[correctOrder[i]]} ${positionLabels[i] ?? `at position ${i + 1}`}`,
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
        text: `Terminate ${wires[correctOrder[i]]} ${label}`,
      });
    }
  }

  rules.push(...shuffle(selectedRules));
  return rules;
}

// -- Component -----------------------------------------------------------------

/**
 * WireCutting -- rule-based deduction minigame with matrix rain visuals.
 *
 * Displays N colored data streams and a set of rules. The player must read
 * the rules and deduce the correct termination order. No default highlighting
 * of the next stream -- that's a meta upgrade.
 *
 * Wrong key = immediate fail. All correct kills = success.
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
      (p) => p.effect.type === "wire-color-labels" && p.effect.minigame === "wire-cutting",
    );
  }, [activePowerUps]);

  // Stream count: 3 (d=0) -> 7 (d=1)
  const wireCount = Math.round(3 + difficulty * 4);

  // Generate puzzle on mount
  const puzzle = useMemo(() => {
    return generatePuzzle(wireCount, difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-generate rain params per stream (stable across renders)
  const rainParams = useMemo(
    () => puzzle.wires.map(() => generateRainParams()),
    [puzzle.wires],
  );

  // Current position in the correct termination order
  const [cutIndex, setCutIndex] = useState(0);
  const cutIndexRef = useRef(0);

  // Track which streams have been killed (by stream index)
  const [cutWires, setCutWires] = useState<Set<number>>(new Set());
  const cutWiresRef = useRef<Set<number>>(new Set());

  // Refs for rain character mutation (avoid re-renders)
  // rainRefs[streamIndex][charIndex] = span element
  const rainRefs = useRef<(HTMLSpanElement | null)[][]>([]);

  // Sync refs with state
  useEffect(() => {
    cutIndexRef.current = cutIndex;
  }, [cutIndex]);

  useEffect(() => {
    cutWiresRef.current = cutWires;
  }, [cutWires]);

  // Character mutation interval — mutate ~12% of visible rain chars every 150ms
  useEffect(() => {
    const interval = setInterval(() => {
      const killed = cutWiresRef.current;
      rainRefs.current.forEach((chars, streamIdx) => {
        if (killed.has(streamIdx)) return; // skip killed streams
        if (!chars) return;
        chars.forEach((span) => {
          if (span && Math.random() < 0.12) {
            span.textContent = randomHex();
          }
        });
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

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

  // The next stream to kill (for conditional highlighting)
  const nextWireIndex =
    cutIndex < puzzle.correctOrder.length ? puzzle.correctOrder[cutIndex] : -1;

  // Helper to register rain span refs
  const setRainRef = useCallback(
    (streamIdx: number, charIdx: number, el: HTMLSpanElement | null) => {
      if (!rainRefs.current[streamIdx]) {
        rainRefs.current[streamIdx] = [];
      }
      rainRefs.current[streamIdx][charIdx] = el;
    },
    [],
  );

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Keyframes for matrix rain animation */}
      <style>{`
        @keyframes stream-fall {
          0% { transform: translateY(-14px); opacity: 0; }
          8% { opacity: 0.8; }
          70% { opacity: 0.5; }
          95% { opacity: 0.15; }
          100% { transform: translateY(140px); opacity: 0; }
        }
      `}</style>

      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-6" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-2xl">
        {/* Rules panel */}
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
          TERMINATED {cutIndex} OF {puzzle.correctOrder.length} PROCESSES
          <span className="text-white/25 ml-2">({puzzle.wires.length} total)</span>
        </p>

        {/* Streams display -- matrix rain */}
        <div className="flex items-end justify-center gap-5">
          {puzzle.wires.map((color, i) => {
            const isCut = cutWires.has(i);
            const isNext = hasWireOrderHint && i === nextWireIndex;
            const isDimmed = hasWireOrderHint && !isNext && !isCut;
            const streamColor = COLOR_CSS[color];

            return (
              <div
                key={i}
                data-testid="stream"
                data-index={i}
                data-next={i === nextWireIndex}
                className="flex flex-col items-center cursor-pointer group"
                style={{
                  transition: "opacity 0.2s",
                  opacity: isDimmed ? 0.35 : 1,
                }}
                onClick={() => handleNumberPress(i + 1)}
              >
                {/* Stream box with matrix rain */}
                <div
                  className="relative overflow-hidden"
                  style={{
                    width: 32,
                    height: 140,
                    borderTop: `2px solid ${isCut ? "rgba(255,255,255,0.06)" : hexToRgba(streamColor, 0.45)}`,
                    borderBottom: `2px solid ${isCut ? "rgba(255,255,255,0.04)" : hexToRgba(streamColor, 0.25)}`,
                    borderLeft: "none",
                    borderRight: "none",
                    boxShadow: isNext ? `0 0 18px ${streamColor}` : "none",
                    transition: "border-color 0.3s, box-shadow 0.3s",
                  }}
                >
                  {/* Rain columns */}
                  {COL_POSITIONS.map((leftPx, colIdx) => (
                    <div
                      key={colIdx}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: leftPx,
                        width: 20,
                      }}
                    >
                      {Array.from({ length: CHARS_PER_COL }, (_, rowIdx) => {
                        const charIdx = colIdx * CHARS_PER_COL + rowIdx;
                        const p = rainParams[i][charIdx];
                        return (
                          <span
                            key={rowIdx}
                            ref={(el) => setRainRef(i, charIdx, el)}
                            style={{
                              position: "absolute",
                              width: "100%",
                              textAlign: "center",
                              fontSize: 10,
                              fontFamily: "monospace",
                              color: isCut
                                ? "rgba(255,255,255,0.12)"
                                : streamColor,
                              opacity: 0,
                              animation: `stream-fall ${p.duration}s linear infinite`,
                              animationDelay: `-${p.delay}s`,
                              animationPlayState: isCut ? "paused" : "running",
                            }}
                          >
                            {p.text}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Stream number */}
                <span
                  className="font-mono font-bold transition-colors duration-200"
                  style={{
                    fontSize: 10,
                    marginTop: 5,
                    color: isCut
                      ? "rgba(255,255,255,0.15)"
                      : streamColor,
                  }}
                >
                  {i + 1}
                </span>

                {/* Color label */}
                <span
                  className="font-mono font-bold uppercase transition-colors duration-200"
                  style={{
                    fontSize: 8,
                    letterSpacing: "0.5px",
                    marginTop: 2,
                    color: isCut
                      ? "rgba(255,255,255,0.1)"
                      : hexToRgba(streamColor, 0.35),
                  }}
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
          Press the process number to terminate
        </p>
        <p className="touch-only text-white/40 text-xs uppercase tracking-widest mb-2">
          Tap a process to terminate
        </p>
        <div className="desktop-only inline-flex items-center gap-1.5 px-4 py-2 border border-white/10 rounded-lg bg-white/5">
          {puzzle.wires.map((color, i) => {
            const isCut = cutWires.has(i);
            const isNextKey = hasWireOrderHint && i === nextWireIndex;
            const keyColor = COLOR_CSS[color];

            return (
              <kbd
                key={i}
                className="px-2 py-1 rounded text-xs font-bold font-mono transition-colors duration-200"
                style={
                  isCut
                    ? { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)" }
                    : isNextKey
                      ? { backgroundColor: hexToRgba(keyColor, 0.2), color: keyColor }
                      : { backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }
                }
              >
                {i + 1}
              </kbd>
            );
          })}
        </div>
      </div>
    </div>
  );
}
