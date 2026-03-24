import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useKeyboard } from "@/hooks/use-keyboard";
import { MinigameShell } from "@/components/layout/MinigameShell";
import { TouchControls } from "@/components/layout/TouchControls";

/** Opener -> closer mapping */
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
 * CloseBrackets -- pattern-matching minigame (redesigned).
 *
 * Shows opening brackets on one line. The player types matching closers
 * in REVERSE order (stack-style). Closers appear inline next to the
 * openers as they are typed.
 *
 * Example: `( [ { \` -> player types `/ } ] )` and sees them appear inline.
 *
 * No "Next character" hint by default — that's a meta upgrade.
 * Wrong key = immediate fail. All correct = success.
 */
export function CloseBrackets(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "close-brackets",
    props,
  );

  const resolvedRef = useRef(false);

  // Bracket Mirror: flash the next expected closer for 0.3 s
  const hasBracketFlash = useMemo(() => {
    return activePowerUps.some(
      (p) => p.effect.type === "bracket-flash" && p.effect.minigame === "close-brackets",
    );
  }, [activePowerUps]);

  // Bracket Reducer tier (1/2/3): removes opener types progressively
  const bracketReducerTier = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "close-brackets",
    );
    return pu ? pu.effect.value : 0;
  }, [activePowerUps]);

  const availableOpeners = useMemo(() => {
    let openers = [...OPENERS]; // ["(", "[", "{", "<", "|", "\\"]
    if (bracketReducerTier >= 1) openers = openers.filter(o => o !== "\\");
    if (bracketReducerTier >= 2) openers = openers.filter(o => o !== "|");
    if (bracketReducerTier >= 3) openers = openers.filter(o => o !== "[");
    return openers;
  }, [bracketReducerTier]);

  // Compute which closers are excluded based on removed openers
  const excludedClosers = useMemo(() => {
    const excluded: string[] = [];
    if (bracketReducerTier >= 1) excluded.push("/");   // closer for "\"
    if (bracketReducerTier >= 2) excluded.push("|");   // closer for "|"
    if (bracketReducerTier >= 3) excluded.push("]");   // closer for "["
    return excluded;
  }, [bracketReducerTier]);

  // Bracket count: range-based, 2-4 (d=0) -> 6-8 (d=1)
  const bracketMin = Math.round(2 + difficulty * 4);
  const bracketMax = Math.round(4 + difficulty * 4);
  const bracketCount = bracketMin + Math.floor(Math.random() * (bracketMax - bracketMin + 1));

  // Generate a random opening sequence on mount
  const sequence = useMemo(() => {
    const seq: string[] = [];
    for (let i = 0; i < bracketCount; i++) {
      seq.push(availableOpeners[Math.floor(Math.random() * availableOpeners.length)]);
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

  // Sync ref with state for use in keyboard handler
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (!isActive || resolvedRef.current) return;

      // Ignore keys for excluded closers (removed bracket types)
      if (excludedClosers.includes(key)) return;

      const idx = currentIndexRef.current;
      const expected = expectedClosers[idx];

      if (key === expected) {
        // Correct key
        const nextIndex = idx + 1;
        setCurrentIndex(nextIndex);

        if (nextIndex >= expectedClosers.length) {
          // All brackets closed -- success
          resolvedRef.current = true;
          complete(true);
        }
      } else {
        // Wrong key -- immediate fail
        resolvedRef.current = true;
        fail();
      }
    },
    [isActive, expectedClosers, excludedClosers, complete, fail],
  );

  // Build the key map for useKeyboard -- only closer keys
  const keyMap = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const key of CLOSER_KEYS) {
      map[key] = () => handleKeyPress(key);
    }
    return map;
  }, [handleKeyPress]);

  useKeyboard(keyMap);

  // Build the inline display: openers | cursor/closers
  // Closers are typed in reverse order, so the first typed closer goes
  // at the rightmost position (matching the last opener).
  const typedClosers = expectedClosers.slice(0, currentIndex);
  const nextExpected = currentIndex < expectedClosers.length ? expectedClosers[currentIndex] : null;

  return (
    <MinigameShell
      timer={timer}
      timerGap="mb-8"
      gap="gap-8"
      desktopHint={
        <>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
            Type the matching closers in reverse order
          </p>
          <div className="inline-flex items-center gap-1.5 px-4 py-2 border border-white/10 rounded-lg bg-white/5">
            {CLOSER_KEYS.filter(k => !excludedClosers.includes(k)).map((key) => (
              <kbd
                key={key}
                className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 font-bold font-mono"
              >
                {key}
              </kbd>
            ))}
          </div>
        </>
      }
      touchHint={
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
          TAP the matching closers
        </p>
      }
    >
      {/* Label */}
      <p className="text-white/40 text-xs uppercase tracking-widest">
        Close the brackets
      </p>

      {/* Inline bracket display */}
      <div className="flex items-center justify-center flex-wrap">
        <div className="flex items-center justify-center font-mono text-3xl sm:text-4xl font-bold tracking-wider">
          {/* Opening brackets */}
          {sequence.map((opener, i) => {
            // This opener corresponds to closer index = sequence.length - 1 - i
            const closerIdx = sequence.length - 1 - i;
            const isMatched = closerIdx < currentIndex;

            return (
              <span
                key={`o-${i}`}
                className={`
                  transition-all duration-200
                  ${isMatched ? "text-cyber-green/50" : "text-cyber-cyan"}
                `}
              >
                {opener}
              </span>
            );
          })}

          {/* Separator + cursor area */}
          <span className="inline-block w-[2px] h-8 sm:h-10 bg-cyber-cyan animate-pulse mx-1" />

          {/* Typed closers (left to right in order typed) */}
          {typedClosers.map((closer, i) => (
            <span
              key={`c-${i}`}
              className="text-cyber-green transition-all duration-150"
            >
              {closer}
            </span>
          ))}

          {/* Remaining closer slots as dim placeholders */}
          {Array.from({ length: expectedClosers.length - currentIndex }).map((_, i) => (
            <span
              key={`p-${i}`}
              className="text-white/10"
            >
              _
            </span>
          ))}
        </div>
      </div>

      {/* Progress */}
      <p className="text-white/40 text-xs uppercase tracking-widest">
        {currentIndex}/{expectedClosers.length} closed
      </p>

      {/* Next character hint -- ONLY if player has the Bracket Mirror meta upgrade */}
      {hasBracketFlash && nextExpected && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-white/40 text-xs uppercase tracking-widest">
            Next
          </p>
          <div
            className={`
              flex items-center justify-center
              w-14 h-14 sm:w-16 sm:h-16
              rounded-xl border-2 border-cyber-cyan/60
              shadow-[0_0_12px_rgba(0,255,255,0.15)]
              bg-cyber-bg/80
            `}
          >
            <span className="text-3xl sm:text-4xl font-mono font-bold text-cyber-cyan">
              {nextExpected}
            </span>
          </div>
        </div>
      )}

      {/* Hidden test helper: expected closer key */}
      <span data-testid="expected-closer" data-key={nextExpected ?? ""} className="hidden" />

      <TouchControls type="brackets" excludedClosers={excludedClosers} />
    </MinigameShell>
  );
}
