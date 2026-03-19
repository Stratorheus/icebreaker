import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { TimerBar } from "@/components/layout/TimerBar";
import { TECH_WORDS } from "@/data/words";

// ---------------------------------------------------------------------------
// Cipher helpers
// ---------------------------------------------------------------------------

type CipherMethod = "letter-swap" | "rot" | "reverse-rot" | "substitution";

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

/**
 * Letter-swap encryption: swap two adjacent letters at positions pos and pos+1.
 * `rotN` is repurposed as the swap position (0-based).
 */
function letterSwapEncrypt(word: string, pos: number): string {
  const chars = [...word];
  const safePos = Math.min(pos, chars.length - 2);
  [chars[safePos], chars[safePos + 1]] = [chars[safePos + 1], chars[safePos]];
  return chars.join("");
}

/** Encrypt `word` using the given method + parameters. */
function encrypt(
  word: string,
  method: CipherMethod,
  rotN: number,
): string {
  switch (method) {
    case "letter-swap":
      return letterSwapEncrypt(word, rotN);
    case "rot":
      return rotWord(word, rotN);
    case "reverse-rot":
      return rotWord(reverseWord(word), rotN);
    case "substitution":
      return substitutionEncrypt(word, rotN);
  }
}

/** Build the method label shown to the player. */
function buildMethodLabel(method: CipherMethod, rotN: number): string {
  switch (method) {
    case "letter-swap":
      return `SWAP positions ${rotN + 1} and ${rotN + 2}`;
    case "rot":
      return `SHIFTED +${rotN}`;
    case "reverse-rot":
      return `REVERSED then SHIFTED +${rotN}`;
    case "substitution":
      return `VOWELS ROTATED + SHIFTED +${rotN}`;
  }
}

/**
 * Build clear, labeled example lines explaining the cipher operation.
 * Returns an array of example strings for multi-line display.
 */
function buildExamples(method: CipherMethod, rotN: number): string[] {
  switch (method) {
    case "letter-swap": {
      const p1 = rotN + 1;
      const p2 = rotN + 2;
      return [
        `Letters at positions ${p1} and ${p2} have been swapped`,
        `To decode: swap them back`,
      ];
    }
    case "rot": {
      // Shift examples: A -> shifted, B -> shifted, C -> shifted
      const a = String.fromCharCode(65 + rotN);
      const b = String.fromCharCode(66 + rotN);
      const c = String.fromCharCode(67 + rotN);
      const shiftExample = `Shift: A\u2192${a}, B\u2192${b}, C\u2192${c}`;
      return [shiftExample, `To decode: shift each letter back by ${rotN}`];
    }
    case "reverse-rot": {
      const a = String.fromCharCode(65 + rotN);
      const b = String.fromCharCode(66 + rotN);
      const c = String.fromCharCode(67 + rotN);
      const shiftExample = `Shift: A\u2192${a}, B\u2192${b}, C\u2192${c}`;
      return [
        shiftExample,
        "Order: word was reversed, then shifted",
        `To decode: shift back by ${rotN}, then reverse`,
      ];
    }
    case "substitution": {
      const a = String.fromCharCode(65 + rotN);
      const b = String.fromCharCode(66 + rotN);
      const c = String.fromCharCode(67 + rotN);
      const shiftExample = `Shift: A\u2192${a}, B\u2192${b}, C\u2192${c}`;
      return [
        "Vowels: A\u2192E\u2192I\u2192O\u2192U\u2192A",
        shiftExample + " (consonants only)",
        `To decode: shift consonants back by ${rotN}, rotate vowels back`,
      ];
    }
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
  if (difficulty < 0.2) return "letter-swap";
  if (difficulty < 0.35) return "rot"; // ROT-1 or ROT-2 only
  if (difficulty < 0.6) return "rot"; // ROT-3 to ROT-7
  if (difficulty <= 0.8) return "reverse-rot";
  return "substitution";
}

/**
 * Choose ROT value (or swap position for letter-swap) scaled by difficulty.
 * For letter-swap, returns a 0-based swap position.
 * For ROT at very low difficulty (d < 0.35), returns 1-2.
 * For ROT at medium difficulty (d 0.35-0.6), returns 3-7.
 * For higher ciphers, returns 3-13.
 */
function pickRotN(difficulty: number, method: CipherMethod, wordLength: number): number {
  if (method === "letter-swap") {
    // Random position within the word (0 to wordLength-2)
    return Math.floor(Math.random() * Math.max(1, wordLength - 1));
  }
  if (difficulty < 0.35) {
    // Very small shifts: 1-2 only
    return Math.floor(Math.random() * 2) + 1;
  }
  if (difficulty < 0.6) {
    // Medium shifts: 3-7
    return Math.floor(Math.random() * 5) + 3;
  }
  // Hard shifts: 3-13
  const min = 3;
  const max = Math.round(3 + difficulty * 10);
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
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame(
    "cipher-crack",
    props,
  );

  const resolvedRef = useRef(false);

  // 3e. Cipher Hint (hint): show one extra letter of the answer
  const extraHintLetter = useMemo(() => {
    const hint = activePowerUps.find(
      (p) => p.effect.type === "hint" && p.effect.minigame === "cipher-crack",
    );
    return hint ? hint.effect.value : 0;
  }, [activePowerUps]);

  // Generate puzzle on mount (stable across re-renders)
  const puzzle = useMemo(() => {
    const pool = getWordPool(difficulty);
    const word = pickOne(pool);
    const method = pickMethod(difficulty);
    const rotN = pickRotN(difficulty, method, word.length);
    const encrypted = encrypt(word, method, rotN);
    const methodLabel = buildMethodLabel(method, rotN);
    const examples = buildExamples(method, rotN);
    return { word, encrypted, methodLabel, examples, method };
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

        {/* Cipher hint — clearly labeled method + examples */}
        <div
          className="px-5 py-3 border rounded-lg text-sm font-mono text-center max-w-sm w-full"
          style={{
            borderColor: "var(--color-cyber-magenta)",
            color: "var(--color-cyber-magenta)",
            backgroundColor: "rgba(255, 0, 102, 0.08)",
          }}
        >
          <div className="font-bold tracking-wider mb-2">
            METHOD: {puzzle.methodLabel}
          </div>
          <div className="flex flex-col gap-1">
            {puzzle.examples.map((ex, i) => (
              <div
                key={i}
                className={`text-xs leading-relaxed ${
                  i === puzzle.examples.length - 1
                    ? "opacity-90 mt-1 font-bold"
                    : "opacity-60"
                }`}
              >
                {ex}
              </div>
            ))}
          </div>
        </div>

        {/* 3e. Extra hint letter from Cipher Hint meta upgrade */}
        {extraHintLetter > 0 && puzzle.word.length > 0 && (
          <div className="text-xs uppercase tracking-widest text-cyber-green/70">
            Hint: starts with "<strong className="text-cyber-green">{puzzle.word[0]}</strong>"
            {puzzle.word.length > 1 && extraHintLetter > 1 && (
              <span>, ends with "<strong className="text-cyber-green">{puzzle.word[puzzle.word.length - 1]}</strong>"</span>
            )}
          </div>
        )}

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
