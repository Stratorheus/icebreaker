import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { TimerBar } from "@/components/layout/TimerBar";
import { TECH_WORDS } from "@/data/words";

// ---------------------------------------------------------------------------
// Cipher helpers
// ---------------------------------------------------------------------------

type CipherMethod = "rot" | "reverse-rot" | "substitution";

/** Apply ROT-N encryption to a lowercase letter. */
function rotChar(ch: string, n: number): string {
  return String.fromCharCode(((ch.charCodeAt(0) - 97 + n) % 26 + 26) % 26 + 97);
}

/** Apply ROT-N to every letter in a word. */
function rotWord(word: string, n: number): string {
  return word
    .split("")
    .map((ch) => rotChar(ch, n))
    .join("");
}

/** Reverse a word. */
function reverseWord(word: string): string {
  return word.split("").reverse().join("");
}

const VOWELS = "aeiou";
const VOWEL_SHIFT: Record<string, string> = {
  a: "e",
  e: "i",
  i: "o",
  o: "u",
  u: "a",
};

/** Vowel-shift + consonant ROT-N encryption. */
function substitutionEncrypt(word: string, n: number): string {
  return word
    .split("")
    .map((ch) => {
      if (VOWELS.includes(ch)) {
        return VOWEL_SHIFT[ch];
      }
      // Consonant — shift by N within the 21-consonant alphabet
      return rotChar(ch, n);
    })
    .join("");
}

/** Encrypt `word` using the given method + parameters. */
function encrypt(
  word: string,
  method: CipherMethod,
  rotN: number,
): string {
  switch (method) {
    case "rot":
      return rotWord(word, rotN);
    case "reverse-rot":
      return rotWord(reverseWord(word), rotN);
    case "substitution":
      return substitutionEncrypt(word, rotN);
  }
}

/** Build the hint string shown to the player. */
function buildHint(method: CipherMethod, rotN: number): string {
  switch (method) {
    case "rot":
      return `ROT-${rotN}`;
    case "reverse-rot":
      return `REVERSE + ROT-${rotN}`;
    case "substitution":
      return `VOWEL SHIFT + ROT-${rotN}`;
  }
}

// ---------------------------------------------------------------------------
// Word pool selection
// ---------------------------------------------------------------------------

function getWordPool(difficulty: number): readonly string[] {
  if (difficulty < 0.35) {
    return TECH_WORDS.short;
  }
  if (difficulty < 0.65) {
    return [...TECH_WORDS.short, ...TECH_WORDS.medium];
  }
  return [...TECH_WORDS.medium, ...TECH_WORDS.long];
}

/** Choose cipher method based on difficulty. */
function pickMethod(difficulty: number): CipherMethod {
  if (difficulty < 0.4) return "rot";
  if (difficulty <= 0.7) return "reverse-rot";
  return "substitution";
}

/** Choose ROT value scaled by difficulty. */
function pickRotN(difficulty: number): number {
  const min = Math.round(1 + difficulty * 2); // 1-3
  const max = Math.round(3 + difficulty * 10); // 3-13
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random item from a readonly array. */
function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CipherCrack -- cipher-decryption typing minigame.
 *
 * An encrypted word + cipher hint are displayed. The player must type
 * the ORIGINAL (decrypted) word. Wrong character = immediate fail.
 * All characters correct = success.
 */
export function CipherCrack(props: MinigameProps) {
  const { difficulty } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "cipher-crack",
    props,
  );

  const resolvedRef = useRef(false);

  // Generate puzzle on mount (stable across re-renders)
  const puzzle = useMemo(() => {
    const pool = getWordPool(difficulty);
    const word = pickOne(pool);
    const method = pickMethod(difficulty);
    const rotN = pickRotN(difficulty);
    const encrypted = encrypt(word, method, rotN);
    const hint = buildHint(method, rotN);
    return { word, encrypted, hint };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Current typed character index
  const [charIndex, setCharIndex] = useState(0);
  const charIndexRef = useRef(0);

  useEffect(() => {
    charIndexRef.current = charIndex;
  }, [charIndex]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive || resolvedRef.current) return;

      const key = e.key.toLowerCase();
      if (key.length !== 1 || key < "a" || key > "z") return;

      e.preventDefault();

      const ci = charIndexRef.current;
      const expected = puzzle.word[ci];

      if (key === expected) {
        const nextChar = ci + 1;
        if (nextChar >= puzzle.word.length) {
          resolvedRef.current = true;
          complete(true);
        } else {
          setCharIndex(nextChar);
        }
      } else {
        resolvedRef.current = true;
        fail();
      }
    },
    [isActive, puzzle.word, complete, fail],
  );

  // Attach keydown listener
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Derived display values
  const typedPortion = puzzle.word.slice(0, charIndex);
  const remainingCount = puzzle.word.length - charIndex;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      {/* Timer */}
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-8" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-lg">
        {/* Encrypted word label */}
        <p className="text-white/30 text-xs uppercase tracking-widest">
          Encrypted signal
        </p>

        {/* Encrypted word — large, magenta (hostile) */}
        <span
          className="text-4xl sm:text-5xl font-mono font-bold tracking-wider"
          style={{ color: "var(--color-cyber-magenta)" }}
        >
          {puzzle.encrypted.toUpperCase()}
        </span>

        {/* Cipher hint */}
        <div
          className="px-4 py-2 border rounded text-sm font-mono tracking-wider"
          style={{
            borderColor: "var(--color-cyber-magenta)",
            color: "var(--color-cyber-magenta)",
            backgroundColor: "rgba(255, 0, 102, 0.08)",
          }}
        >
          METHOD: {puzzle.hint}
        </div>

        {/* Divider */}
        <div className="w-24 h-px bg-white/10 my-2" />

        {/* Player input label */}
        <p className="text-white/30 text-xs uppercase tracking-widest">
          Decrypted output
        </p>

        {/* Terminal-style input display */}
        <div className="flex items-center justify-center min-h-[3.5rem]">
          <div className="flex items-center justify-center font-mono text-3xl sm:text-4xl tracking-wider">
            {/* Typed characters */}
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

            {/* Remaining slots as dim underscores */}
            {Array.from({ length: remainingCount }).map((_, i) => (
              <span key={`r-${i}`} className="text-white/15 font-bold">
                _
              </span>
            ))}
          </div>
        </div>

        {/* Character progress */}
        <p className="text-white/40 text-xs uppercase tracking-widest">
          {charIndex}/{puzzle.word.length}
        </p>
      </div>

      {/* Instruction */}
      <div className="mt-8 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest">
          Type the decrypted word &mdash; wrong key = fail
        </p>
      </div>
    </div>
  );
}
