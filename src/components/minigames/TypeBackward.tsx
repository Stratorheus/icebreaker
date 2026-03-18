import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { TimerBar } from "@/components/layout/TimerBar";
import { TECH_WORDS } from "@/data/words";

/** Pick `count` random items from `pool` without repeats. */
function pickRandom<T>(pool: readonly T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Choose the word pool based on difficulty. */
function getWordPool(difficulty: number): readonly string[] {
  if (difficulty < 0.3) {
    return TECH_WORDS.short;
  }
  if (difficulty <= 0.6) {
    return [...TECH_WORDS.short, ...TECH_WORDS.medium];
  }
  return [...TECH_WORDS.medium, ...TECH_WORDS.long];
}

/**
 * TypeBackward -- word-reversal typing minigame.
 *
 * A tech word is displayed. The player must type it BACKWARD, one
 * character at a time. Wrong character = immediate fail. Complete all
 * words in sequence to succeed.
 */
export function TypeBackward(props: MinigameProps) {
  const { difficulty } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "type-backward",
    props,
  );

  const resolvedRef = useRef(false);

  // Number of words: 2 (d=0) -> 5 (d=1)
  const wordCount = Math.round(2 + difficulty * 3);

  // Generate word sequence on mount
  const words = useMemo(() => {
    const pool = getWordPool(difficulty);
    return pickRandom(pool, wordCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Current word index
  const [wordIndex, setWordIndex] = useState(0);
  // Current character position within the reversed word
  const [charIndex, setCharIndex] = useState(0);

  // Refs for use inside the keydown handler (avoids stale closures)
  const wordIndexRef = useRef(0);
  const charIndexRef = useRef(0);

  useEffect(() => {
    wordIndexRef.current = wordIndex;
  }, [wordIndex]);

  useEffect(() => {
    charIndexRef.current = charIndex;
  }, [charIndex]);

  // The reversed version of each word
  const reversedWords = useMemo(
    () => words.map((w) => w.split("").reverse().join("")),
    [words],
  );

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive || resolvedRef.current) return;

      // Only process single letter keys (a-z)
      const key = e.key.toLowerCase();
      if (key.length !== 1 || key < "a" || key > "z") return;

      // Prevent default to avoid any browser shortcut interference
      e.preventDefault();

      const wi = wordIndexRef.current;
      const ci = charIndexRef.current;
      const reversed = reversedWords[wi];
      const expected = reversed[ci];

      if (key === expected) {
        // Correct character
        const nextChar = ci + 1;

        if (nextChar >= reversed.length) {
          // Word complete -- advance to next word or finish
          const nextWord = wi + 1;
          if (nextWord >= words.length) {
            // All words done -- success!
            resolvedRef.current = true;
            complete(true);
          } else {
            setWordIndex(nextWord);
            setCharIndex(0);
          }
        } else {
          setCharIndex(nextChar);
        }
      } else {
        // Wrong character -- immediate fail
        resolvedRef.current = true;
        fail();
      }
    },
    [isActive, reversedWords, words.length, complete, fail],
  );

  // Attach keydown listener for ALL letter input
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Derived display values
  const currentWord = words[wordIndex] ?? "";
  const currentReversed = reversedWords[wordIndex] ?? "";
  const typedPortion = currentReversed.slice(0, charIndex);
  const remainingPortion = currentReversed.slice(charIndex);

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-8" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-lg">
        {/* Word counter */}
        <p className="text-white/40 text-xs uppercase tracking-widest">
          Word {wordIndex + 1}/{words.length}
        </p>

        {/* Current word displayed large */}
        <div className="text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">
            Type this word backward
          </p>
          <span className="text-4xl sm:text-5xl font-mono font-bold text-cyber-cyan tracking-wider">
            {currentWord}
          </span>
        </div>

        {/* Divider */}
        <div className="w-24 h-px bg-white/10" />

        {/* Typed progress display */}
        <div className="text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">
            Your input
          </p>
          <div className="flex items-center justify-center min-h-[3.5rem]">
            <div className="flex items-center justify-center font-mono text-3xl sm:text-4xl tracking-wider">
              {/* Characters already typed */}
              {typedPortion.split("").map((ch, i) => (
                <span
                  key={i}
                  className="text-cyber-green font-bold transition-colors duration-100"
                >
                  {ch}
                </span>
              ))}

              {/* Blinking cursor */}
              <span className="inline-block w-[2px] h-8 sm:h-10 bg-cyber-cyan animate-pulse mx-0.5" />

              {/* Remaining slots shown as dim underscores */}
              {remainingPortion.split("").map((_, i) => (
                <span
                  key={`r-${i}`}
                  className="text-white/15 font-bold"
                >
                  _
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Completed words indicator */}
        {words.length > 1 && (
          <div className="flex items-center gap-2 mt-2">
            {words.map((_, i) => (
              <div
                key={i}
                className={`
                  w-3 h-3 rounded-full transition-all duration-200
                  ${
                    i < wordIndex
                      ? "bg-cyber-green shadow-[0_0_6px_rgba(0,255,65,0.5)]"
                      : i === wordIndex
                        ? "bg-cyber-cyan shadow-[0_0_6px_rgba(0,255,255,0.4)]"
                        : "bg-white/15"
                  }
                `}
              />
            ))}
          </div>
        )}
      </div>

      {/* Instruction */}
      <div className="mt-8 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest">
          Type each letter in reverse order &mdash; wrong key = fail
        </p>
      </div>
    </div>
  );
}
