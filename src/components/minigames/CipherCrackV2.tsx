import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { TimerBar } from "@/components/layout/TimerBar";
import { TECH_WORDS } from "@/data/words";

// ---------------------------------------------------------------------------
// Cipher helpers (duplicated from CipherCrack — tiny, not worth a shared file)
// ---------------------------------------------------------------------------

type CipherMethod = "rot" | "reverse-rot";

/** Apply ROT-N encryption to a lowercase letter. */
function rotChar(ch: string, n: number): string {
  return String.fromCharCode(((ch.charCodeAt(0) - 97 + n) % 26 + 26) % 26 + 97);
}

/** Apply ROT-N to every letter in a word. */
function rotWord(word: string, n: number): string {
  return word.split("").map((ch) => rotChar(ch, n)).join("");
}

/** Reverse a word. */
function reverseWord(word: string): string {
  return word.split("").reverse().join("");
}

/** Encrypt a word using the given method. */
function encrypt(word: string, method: CipherMethod, rotN: number): string {
  switch (method) {
    case "rot":
      return rotWord(word, rotN);
    case "reverse-rot":
      return rotWord(reverseWord(word), rotN);
  }
}

/** Build the method label shown to the player. */
function buildMethodLabel(method: CipherMethod, rotN: number): string {
  switch (method) {
    case "rot":
      return `SHIFTED +${rotN}`;
    case "reverse-rot":
      return `REVERSED then SHIFTED +${rotN}`;
  }
}

/** Build help text lines. */
function buildExamples(method: CipherMethod): string[] {
  switch (method) {
    case "rot":
      return ["Use the alphabet chart below to decode each letter"];
    case "reverse-rot":
      return [
        "Word was reversed, then each letter shifted",
        "To decode: use chart to unshift, then reverse",
      ];
  }
}

// ---------------------------------------------------------------------------
// Word pool + method selection
// ---------------------------------------------------------------------------

function getWordPool(difficulty: number): readonly string[] {
  if (difficulty < 0.35) return TECH_WORDS.short;
  if (difficulty < 0.65) return [...TECH_WORDS.short, ...TECH_WORDS.medium];
  return [...TECH_WORDS.medium, ...TECH_WORDS.long];
}

function pickMethod(difficulty: number): CipherMethod {
  if (difficulty < 0.5) return "rot";
  return "reverse-rot";
}

function pickRotN(): number {
  // ROT 1-3 only
  return Math.floor(Math.random() * 3) + 1;
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Alphabet chart component (same as CipherCrack)
// ---------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function AlphabetChart({ rotN }: { rotN: number }) {
  return (
    <div className="w-full max-w-md mx-auto mt-2 px-2">
      <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1 text-center">
        Alphabet reference (shift +{rotN})
      </p>
      <div className="grid grid-cols-13 gap-0 text-center font-mono text-[11px] leading-tight">
        {/* First row: original A-M */}
        {ALPHABET.slice(0, 13).split("").map((ch, i) => (
          <div key={`o1-${i}`} className="text-white/30 py-0.5">{ch}</div>
        ))}
        {/* Second row: shifted A-M */}
        {ALPHABET.slice(0, 13).split("").map((ch, i) => (
          <div key={`s1-${i}`} className="text-cyber-cyan/70 py-0.5 font-bold">
            {String.fromCharCode(((ch.charCodeAt(0) - 65 + rotN) % 26) + 65)}
          </div>
        ))}
        {/* Third row: original N-Z */}
        {ALPHABET.slice(13).split("").map((ch, i) => (
          <div key={`o2-${i}`} className="text-white/30 py-0.5">{ch}</div>
        ))}
        {/* Fourth row: shifted N-Z */}
        {ALPHABET.slice(13).split("").map((ch, i) => (
          <div key={`s2-${i}`} className="text-cyber-cyan/70 py-0.5 font-bold">
            {String.fromCharCode(((ch.charCodeAt(0) - 65 + rotN) % 26) + 65)}
          </div>
        ))}
      </div>
      <p className="text-white/20 text-[9px] text-center mt-1">
        Top = original, bottom = encrypted. Find encrypted letter on bottom, read original above.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CipherCrackV2 -- ROT-only cipher cracking with permanent alphabet chart.
 *
 * Same typing mechanic as CipherCrack, but ONLY uses ROT ciphers
 * (ROT-1 to ROT-3, and reverse+ROT at higher difficulty).
 * Always shows the alphabet reference chart.
 *
 * Difficulty scaling:
 *   d<0.5:  ROT-1 to ROT-3 (plain rotation)
 *   d>=0.5: Reverse + ROT-1 to ROT-3
 */
export function CipherCrackV2(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("cipher-crack-v2", props);

  const resolvedRef = useRef(false);

  // Cipher Hint meta upgrade: show first letter of answer
  const extraHintLetter = useMemo(() => {
    const hint = activePowerUps.find(
      (p) => p.effect.type === "hint" && p.effect.minigame === "cipher-crack-v2",
    );
    return hint ? hint.effect.value : 0;
  }, [activePowerUps]);

  // Generate puzzle on mount
  const puzzle = useMemo(() => {
    const pool = getWordPool(difficulty);
    const word = pickOne(pool);
    const method = pickMethod(difficulty);
    const rotN = pickRotN();
    const encrypted = encrypt(word, method, rotN);
    const methodLabel = buildMethodLabel(method, rotN);
    const examples = buildExamples(method);
    return { word, encrypted, methodLabel, examples, method, rotN };
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

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const typedPortion = puzzle.word.slice(0, charIndex);
  const remainingCount = puzzle.word.length - charIndex;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full select-none px-4 py-6">
      <TimerBar progress={timer.progress} className="w-full max-w-md mb-6" />

      <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-lg">
        <p className="text-white/30 text-xs uppercase tracking-widest">
          Encrypted signal
        </p>

        {/* Encrypted word */}
        <span
          className="text-4xl sm:text-5xl font-mono font-bold tracking-wider"
          style={{ color: "var(--color-cyber-magenta)" }}
        >
          {puzzle.encrypted.toUpperCase()}
        </span>

        {/* Cipher hint box */}
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
                    ? "opacity-90 font-bold"
                    : "opacity-60"
                }`}
              >
                {ex}
              </div>
            ))}
          </div>
        </div>

        {/* Alphabet chart -- always shown */}
        <AlphabetChart rotN={puzzle.rotN} />

        {/* Extra hint from meta upgrade */}
        {extraHintLetter > 0 && puzzle.word.length > 0 && (
          <div className="text-xs uppercase tracking-widest text-cyber-green/70">
            Hint: starts with &ldquo;<strong className="text-cyber-green">{puzzle.word[0]}</strong>&rdquo;
          </div>
        )}

        <div className="w-24 h-px bg-white/10 my-1" />

        <p className="text-white/30 text-xs uppercase tracking-widest">
          Decrypted output
        </p>

        {/* Input display */}
        <div className="flex items-center justify-center min-h-[3.5rem]">
          <div className="flex items-center justify-center font-mono text-3xl sm:text-4xl tracking-wider">
            {typedPortion.split("").map((ch, i) => (
              <span key={i} className="text-cyber-green font-bold">{ch}</span>
            ))}
            <span className="inline-block w-[2px] h-8 sm:h-10 bg-cyber-cyan animate-pulse mx-0.5" />
            {Array.from({ length: remainingCount }).map((_, i) => (
              <span key={`r-${i}`} className="text-white/15 font-bold">_</span>
            ))}
          </div>
        </div>

        <p className="text-white/40 text-xs uppercase tracking-widest">
          {charIndex}/{puzzle.word.length}
        </p>
      </div>

      <div className="mt-6 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest">
          Type the decrypted word &mdash; wrong key = fail
        </p>
      </div>
    </div>
  );
}
