import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useTouchDevice } from "@/hooks/use-touch-device";
import { TimerBar } from "@/components/layout/TimerBar";
import { TECH_WORDS } from "@/data/words";

/** Pick `count` random items from `pool` without repeats. */
function pickRandom<T>(pool: readonly T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Difficulty-scaled word pool — shorter words at lower difficulty. */
function getWordPool(difficulty: number): readonly string[] {
  if (difficulty < 0.3) {
    // Easy: mostly short, some medium
    return [...TECH_WORDS.short, ...TECH_WORDS.short, ...TECH_WORDS.medium];
  }
  if (difficulty < 0.6) {
    // Medium: short + medium
    return [...TECH_WORDS.short, ...TECH_WORDS.medium];
  }
  // Hard: all words
  return [...TECH_WORDS.short, ...TECH_WORDS.medium, ...TECH_WORDS.long];
}

/**
 * TypeBackward -- word-reversal typing minigame.
 *
 * Mechanic:
 * 1. Original words are picked (e.g. ["kernel", "proxy", "cache"])
 * 2. Each word is mirrored/reversed (e.g. ["lenrek", "yxorp", "ehcac"])
 * 3. The mirrored words are displayed in REVERSE order: ["ehcac", "yxorp", "lenrek"]
 * 4. Player types the ORIGINAL (un-mirrored) word for each displayed word,
 *    starting from the first displayed mirrored word.
 *    So they type: "cache" (for "ehcac"), then "proxy" (for "yxorp"), then "kernel" (for "lenrek")
 *
 * Wrong character = immediate fail. Complete all words to succeed.
 */
export function TypeBackward(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "type-backward",
    props,
  );

  const resolvedRef = useRef(false);

  // Touch device: hidden input for system keyboard
  const isTouch = useTouchDevice();
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isTouch && hiddenInputRef.current) {
      setTimeout(() => hiddenInputRef.current?.focus(), 300);
    }
  }, [isTouch]);

  // Autocorrect (reverse-trainer): fraction of words shown in normal order (0.25-1.0)
  const autocorrectFraction = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "type-backward",
    );
    return pu ? pu.effect.value : 0;
  }, [activePowerUps]);

  // Number of words: range-based, 2-4 (d=0) -> 5-8 (d=1)
  const wordCountMin = Math.round(2 + difficulty * 3);
  const wordCountMax = Math.round(4 + difficulty * 4);
  const wordCount = wordCountMin + Math.floor(Math.random() * (wordCountMax - wordCountMin + 1));

  // Generate word sequence on mount
  const originalWords = useMemo(() => {
    const pool = getWordPool(difficulty);
    return pickRandom(pool, wordCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror each word
  const mirroredWords = useMemo(
    () => originalWords.map((w) => w.split("").reverse().join("")),
    [originalWords],
  );

  // Autocorrect: determine which word indices (in original order) are "corrected" (shown normally)
  const correctedIndices = useMemo(() => {
    if (autocorrectFraction <= 0) return new Set<number>();
    const normalCount = Math.ceil(originalWords.length * autocorrectFraction);
    // Pick normalCount random indices to show in normal order
    const indices = originalWords.map((_, i) => i);
    // Shuffle and pick first normalCount
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return new Set(indices.slice(0, normalCount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // originalWords is stable (mount-only useMemo), so this is safe
  }, []);

  // Display order: reversed list. Corrected words show in normal order, others mirrored.
  // displayWords[0] corresponds to originalWords[N-1], etc.
  const displayWords = useMemo(() => {
    const words = originalWords.map((orig, i) =>
      correctedIndices.has(i) ? orig : mirroredWords[i],
    );
    return [...words].reverse();
  }, [mirroredWords, originalWords, correctedIndices]);

  // Track which display indices are "corrected" (shown normally) for visual indicator
  const correctedDisplayIndices = useMemo(() => {
    const set = new Set<number>();
    const n = originalWords.length;
    for (const origIdx of correctedIndices) {
      // display index = n - 1 - origIdx
      set.add(n - 1 - origIdx);
    }
    return set;
  }, [correctedIndices, originalWords.length]);

  // Expected answers: un-mirror each displayed word to get the answer to type.
  // For corrected words (shown normally), the answer IS the displayed word.
  // For mirrored words, the answer is the reverse of the displayed word.
  const expectedAnswers = useMemo(
    () => displayWords.map((dw, i) =>
      correctedDisplayIndices.has(i) ? dw : dw.split("").reverse().join(""),
    ),
    [displayWords, correctedDisplayIndices],
  );

  // Current word index (in display order)
  const [wordIndex, setWordIndex] = useState(0);
  // Current character position within the current answer
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
      const answer = expectedAnswers[wi];
      const expected = answer[ci];

      if (key === expected) {
        // Correct character
        const nextChar = ci + 1;

        if (nextChar >= answer.length) {
          // Word complete -- advance to next word or finish
          const nextWord = wi + 1;
          if (nextWord >= expectedAnswers.length) {
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
    [isActive, expectedAnswers, complete, fail],
  );

  // Attach keydown listener for ALL letter input
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Current answer's typed/remaining for input display
  const currentAnswer = expectedAnswers[wordIndex] ?? "";
  const typedPortion = currentAnswer.slice(0, charIndex);
  const remainingPortion = currentAnswer.slice(charIndex);

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-6" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-lg">
        {/* All mirrored words displayed in reverse order */}
        <div className="text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
            Unscramble each mirrored word
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {displayWords.map((word, i) => {
              const isCompleted = i < wordIndex;
              const isCurrent = i === wordIndex;
              const isPending = i > wordIndex;
              const isCorrected = correctedDisplayIndices.has(i);

              return (
                <div key={i} className="flex items-center gap-1.5">
                  {isCompleted && (
                    <span className="text-cyber-green text-sm">&#10003;</span>
                  )}
                  <span
                    className={`
                      text-2xl sm:text-3xl font-mono font-bold tracking-wider
                      transition-all duration-200
                      ${
                        isCompleted
                          ? "text-white/25 line-through decoration-white/20"
                          : isCurrent
                            ? "text-cyber-magenta"
                            : isPending
                              ? "text-white/40"
                              : ""
                      }
                    `}
                  >
                    {word}
                  </span>
                  {isCorrected && !isCompleted && (
                    <span className="text-cyber-green text-[10px]" title="Autocorrected">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="w-24 h-px bg-white/10" />

        {/* Word counter */}
        <p className="text-white/40 text-xs uppercase tracking-widest">
          Word {wordIndex + 1}/{displayWords.length}
        </p>

        {/* Autocorrect indicator */}
        {autocorrectFraction > 0 && (
          <p className="text-cyber-green/50 text-[10px] uppercase tracking-widest">
            AUTOCORRECT ACTIVE — {Math.round(autocorrectFraction * 100)}% CORRECTED
          </p>
        )}

        {/* Typed progress display */}
        <div className="text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">
            Type the original word
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

        {/* Completed words indicator dots */}
        {displayWords.length > 1 && (
          <div className="flex items-center gap-2 mt-2">
            {displayWords.map((_, i) => (
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

      {/* Hidden input for mobile keyboard */}
      <input
        ref={hiddenInputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="fixed -top-24 -left-24 w-px h-px opacity-0"
        onInput={(e) => {
          const target = e.target as HTMLInputElement;
          for (const char of target.value) {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
          }
          target.value = "";
        }}
      />

      {/* Instruction — desktop */}
      <div className="desktop-only mt-6 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest">
          Read the mirrored word, type the original &mdash; wrong key = fail
        </p>
      </div>

      {/* Touch: tap to type prompt */}
      <div className="touch-only mt-6 text-center">
        <button
          type="button"
          className="px-4 py-2 border border-cyber-cyan/40 rounded-lg bg-cyber-cyan/10 text-cyber-cyan text-xs uppercase tracking-widest font-mono animate-pulse"
          onClick={() => hiddenInputRef.current?.focus()}
        >
          TAP HERE TO TYPE
        </button>
        <p className="text-white/40 text-xs uppercase tracking-widest mt-2">
          Type the original word &mdash; wrong key = fail
        </p>
      </div>
    </div>
  );
}
