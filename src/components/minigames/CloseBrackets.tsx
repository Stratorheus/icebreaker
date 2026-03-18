import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { TimerBar } from "@/components/layout/TimerBar";

/** Opener → closer mapping */
const BRACKET_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "<": ">",
  "|": "|",
  "\\": "/",
};

const OPENERS = Object.keys(BRACKET_PAIRS);

/** All possible closer keys the player might press */
const CLOSER_KEYS = [")", "]", "}", ">", "|", "/"];

/**
 * CloseBrackets — pattern-matching minigame.
 *
 * Shows a random sequence of opening brackets. The player must type
 * the matching closers in REVERSE order (stack-style).
 *
 * Example: `( [ { \` → player types `/ } ] )`
 *
 * Wrong key = immediate fail. All correct = success.
 */
export function CloseBrackets(props: MinigameProps) {
  const { difficulty } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "close-brackets",
    props,
  );

  const resolvedRef = useRef(false);

  // Bracket count: 3 (d=0) → 8 (d=1)
  const bracketCount = Math.round(3 + difficulty * 5);

  // Generate a random opening sequence on mount
  const sequence = useMemo(() => {
    const seq: string[] = [];
    for (let i = 0; i < bracketCount; i++) {
      seq.push(OPENERS[Math.floor(Math.random() * OPENERS.length)]);
    }
    return seq;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expected closers in reverse order
  const expectedClosers = useMemo(
    () => [...sequence].reverse().map((opener) => BRACKET_PAIRS[opener]),
    [sequence],
  );

  // Current position in the expected closers array
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  // Track which closers have been correctly typed (for visual feedback)
  const [typedClosers, setTypedClosers] = useState<string[]>([]);

  // Sync ref with state for use in keyboard handler
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (!isActive || resolvedRef.current) return;

      const idx = currentIndexRef.current;
      const expected = expectedClosers[idx];

      if (key === expected) {
        // Correct key
        const nextIndex = idx + 1;
        setCurrentIndex(nextIndex);
        setTypedClosers((prev) => [...prev, key]);

        if (nextIndex >= expectedClosers.length) {
          // All brackets closed — success
          resolvedRef.current = true;
          complete(true);
        }
      } else {
        // Wrong key — immediate fail
        resolvedRef.current = true;
        fail();
      }
    },
    [isActive, expectedClosers, complete, fail],
  );

  // Build the key map for useKeyboard — only closer keys
  const keyMap = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const key of CLOSER_KEYS) {
      map[key] = () => handleKeyPress(key);
    }
    return map;
  }, [handleKeyPress]);

  useKeyboard(keyMap);

  // How many closers remain
  const remaining = expectedClosers.length - currentIndex;
  const nextExpected = currentIndex < expectedClosers.length ? expectedClosers[currentIndex] : null;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-8" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-lg">
        {/* Opening sequence display */}
        <div className="text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
            Opening Sequence
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {sequence.map((opener, i) => {
              // Reverse index: this opener corresponds to expectedClosers[sequence.length - 1 - i]
              const closerIndex = sequence.length - 1 - i;
              const isCompleted = closerIndex < currentIndex;
              const isNext = closerIndex === currentIndex;

              return (
                <span
                  key={i}
                  className={`
                    text-3xl sm:text-4xl font-mono font-bold transition-all duration-200
                    ${isCompleted ? "text-cyber-green opacity-50" : isNext ? "text-cyber-cyan" : "text-white/60"}
                  `}
                >
                  {opener}
                </span>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="w-24 h-px bg-white/10" />

        {/* Closers progress display */}
        <div className="text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
            Type Closers (Reverse Order)
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {expectedClosers.map((closer, i) => {
              const isTyped = i < currentIndex;
              const isNext = i === currentIndex;

              return (
                <span
                  key={i}
                  className={`
                    text-3xl sm:text-4xl font-mono font-bold transition-all duration-200
                    ${isTyped ? "text-cyber-green" : isNext ? "text-cyber-cyan animate-pulse" : "text-white/20"}
                  `}
                >
                  {isTyped || isNext ? closer : "?"}
                </span>
              );
            })}
          </div>
        </div>

        {/* Next expected indicator */}
        {nextExpected && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-white/40 text-xs uppercase tracking-widest">
              Next
            </p>
            <div
              className={`
                flex items-center justify-center
                w-16 h-16 sm:w-20 sm:h-20
                rounded-xl border-2 border-cyber-cyan
                shadow-[0_0_20px_rgba(0,255,255,0.2)]
                bg-cyber-bg/80
              `}
            >
              <span className="text-4xl sm:text-5xl font-mono font-bold text-cyber-cyan">
                {nextExpected}
              </span>
            </div>
            <p className="text-white/30 text-xs">
              {remaining} remaining
            </p>
          </div>
        )}
      </div>

      {/* Instruction */}
      <div className="mt-8 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          Type the matching closers in reverse order
        </p>
        <div className="inline-flex items-center gap-1.5 px-4 py-2 border border-white/10 rounded-lg bg-white/5">
          {CLOSER_KEYS.map((key) => (
            <kbd
              key={key}
              className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono"
            >
              {key}
            </kbd>
          ))}
        </div>
      </div>
    </div>
  );
}
