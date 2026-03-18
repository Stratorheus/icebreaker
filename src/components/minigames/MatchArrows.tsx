import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

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
 */
export function MatchArrows(props: MinigameProps) {
  const { difficulty } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "match-arrows",
    props,
  );

  const resolvedRef = useRef(false);

  // Row length: 4 (d=0) -> 10 (d=1)
  const rowLength = Math.round(4 + difficulty * 6);

  // Generate random arrow sequence on mount
  const sequence = useMemo(() => {
    const seq: ArrowKey[] = [];
    for (let i = 0; i < rowLength; i++) {
      seq.push(ARROWS[Math.floor(Math.random() * ARROWS.length)].key);
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
            const isHidden = i > currentIndex;

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
                        : isHidden
                          ? "border-white/10 bg-white/5 text-white/20"
                          : ""
                  }
                `}
              >
                {isCompleted || isCurrent ? getArrowChar(arrowKey) : "?"}
              </div>
            );
          })}
        </div>

        {/* Current arrow indicator */}
        {currentIndex < sequence.length && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-white/40 text-xs uppercase tracking-widest">
              Press
            </p>
            <div
              className={`
                flex items-center justify-center
                w-20 h-20 sm:w-24 sm:h-24
                rounded-xl border-2 border-cyber-green
                shadow-[0_0_24px_rgba(0,255,65,0.3)]
                bg-cyber-bg/80
              `}
            >
              <span className="text-5xl sm:text-6xl font-mono font-bold text-cyber-green">
                {getArrowChar(sequence[currentIndex])}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Arrow key hints */}
      <div className="mt-8 text-center">
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
    </div>
  );
}
