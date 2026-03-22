import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";
import { TouchControls } from "@/components/layout/TouchControls";

/** Arrow directions with display characters and corresponding key codes */
const ARROWS = [
  { key: "ArrowUp", char: "\u2191", label: "\u2191" },
  { key: "ArrowDown", char: "\u2193", label: "\u2193" },
  { key: "ArrowLeft", char: "\u2190", label: "\u2190" },
  { key: "ArrowRight", char: "\u2192", label: "\u2192" },
] as const;

type ArrowKey = (typeof ARROWS)[number]["key"];

/**
 * MatchArrows -- sequential arrow-matching minigame.
 *
 * A row of hidden arrows is generated. The first arrow is revealed;
 * the player must press the matching arrow key. Correct key reveals
 * the next arrow. Wrong key = immediate fail. All matched = success.
 *
 * The large "Press [arrow]" hint is removed by default. It only shows
 * if the player has the relevant meta upgrade (hint + match-arrows).
 */
export function MatchArrows(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "match-arrows",
    props,
  );

  // Row length: range-based, 3-5 (d=0) -> 7-10 (d=1). Stable on mount.
  const rowLength = useMemo(() => {
    const rowMin = Math.round(3 + difficulty * 4);
    const rowMax = Math.round(5 + difficulty * 5);
    return rowMin + Math.floor(Math.random() * (rowMax - rowMin + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Peek-ahead: how many arrows ahead of the current one to reveal (percentage-based from meta, fixed from run-shop)
  const peekAhead = useMemo(() => {
    let count = 0;
    for (const pu of activePowerUps) {
      if (pu.effect.type === "peek-ahead" && (!pu.effect.minigame || pu.effect.minigame === "match-arrows")) {
        const val = pu.effect.value;
        if (val < 1) {
          // Percentage-based (meta upgrade): use floor to avoid exceeding available slots
          count = Math.max(count, Math.floor(rowLength * val));
        } else {
          // Fixed count (run-shop power-up)
          count = Math.max(count, val);
        }
      }
    }
    // Cap at sequence length - 1 to prevent peeking beyond the last arrow
    return Math.min(count, rowLength - 1);
  }, [activePowerUps, rowLength]);

  const resolvedRef = useRef(false);

  // Generate random arrow sequence on mount (max 2 identical in a row)
  const sequence = useMemo(() => {
    const seq: ArrowKey[] = [];
    for (let i = 0; i < rowLength; i++) {
      seq.push(ARROWS[Math.floor(Math.random() * ARROWS.length)].key);
    }
    // Post-process: no 3+ consecutive identical arrows
    for (let i = 2; i < seq.length; i++) {
      if (seq[i] === seq[i - 1] && seq[i] === seq[i - 2]) {
        const alts = ARROWS.filter((a) => a.key !== seq[i]);
        seq[i] = alts[Math.floor(Math.random() * alts.length)].key;
      }
    }
    return seq;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Current position in the sequence
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  // Sync ref with state for use in keyboard handler
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const handleArrowPress = useCallback(
    (key: ArrowKey) => {
      if (!isActive || resolvedRef.current) return;

      const idx = currentIndexRef.current;
      const expected = sequence[idx];

      if (key === expected) {
        // Correct key -- advance
        const nextIndex = idx + 1;
        setCurrentIndex(nextIndex);

        if (nextIndex >= sequence.length) {
          // All arrows matched -- success
          resolvedRef.current = true;
          complete(true);
        }
      } else {
        // Wrong key -- immediate fail
        resolvedRef.current = true;
        fail();
      }
    },
    [isActive, sequence, complete, fail],
  );

  // Build the key map for useKeyboard -- only arrow keys
  const keyMap = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const arrow of ARROWS) {
      map[arrow.key] = () => handleArrowPress(arrow.key);
    }
    return map;
  }, [handleArrowPress]);

  useKeyboard(keyMap);

  /** Get the display character for an arrow key */
  const getArrowChar = (key: ArrowKey): string =>
    ARROWS.find((a) => a.key === key)?.char ?? "?";

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-8" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-2xl">
        {/* Progress counter */}
        <p className="text-white/40 text-xs uppercase tracking-widest">
          {currentIndex}/{sequence.length}
        </p>

        {/* Arrow row */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          {sequence.map((arrowKey, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isPeeked = !isCompleted && !isCurrent && i <= currentIndex + peekAhead;
            const isHidden = i > currentIndex && !isPeeked;

            return (
              <div
                key={i}
                className={`
                  flex items-center justify-center
                  w-12 h-12 sm:w-14 sm:h-14
                  rounded-lg border-2 font-mono font-bold
                  text-2xl sm:text-3xl
                  transition-all duration-200
                  ${
                    isCompleted
                      ? "border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan"
                      : isCurrent
                        ? "border-cyber-green bg-cyber-green/10 text-cyber-green animate-pulse shadow-[0_0_20px_rgba(0,255,65,0.3)]"
                        : isPeeked
                          ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400/70"
                          : isHidden
                            ? "border-white/10 bg-white/5 text-white/20"
                            : ""
                  }
                `}
              >
                {isCompleted || isCurrent || isPeeked ? getArrowChar(arrowKey) : "?"}
              </div>
            );
          })}
        </div>

        {/* Hidden test helper: expected arrow key */}
        <span data-testid="expected-arrow" data-key={sequence[currentIndex]} className="hidden" />
      </div>

      {/* Arrow key hints (layout reference -- desktop) */}
      <div className="desktop-only mt-8 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          Match the arrow with arrow keys
        </p>
        <div className="inline-flex flex-col items-center gap-1">
          {/* Top row: up arrow */}
          <kbd className="px-3 py-1.5 bg-white/10 rounded text-sm text-white/70 font-bold font-mono">
            {"\u2191"}
          </kbd>
          {/* Bottom row: left, down, right */}
          <div className="flex items-center gap-1">
            <kbd className="px-3 py-1.5 bg-white/10 rounded text-sm text-white/70 font-bold font-mono">
              {"\u2190"}
            </kbd>
            <kbd className="px-3 py-1.5 bg-white/10 rounded text-sm text-white/70 font-bold font-mono">
              {"\u2193"}
            </kbd>
            <kbd className="px-3 py-1.5 bg-white/10 rounded text-sm text-white/70 font-bold font-mono">
              {"\u2192"}
            </kbd>
          </div>
        </div>
      </div>

      {/* Touch: D-pad + instruction */}
      <div className="touch-only mt-4 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          TAP the matching direction
        </p>
      </div>
      <TouchControls type="dpad" />
    </div>
  );
}
