import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useTouchDevice } from "@/hooks/use-touch-device";
import { TimerBar } from "@/components/layout/TimerBar";
import { TECH_WORDS } from "@/data/words";

// ---------------------------------------------------------------------------
// Cipher helpers
// ---------------------------------------------------------------------------

type CipherMethod = "letter-swap" | "remove-vowels" | "scramble";

const VOWELS = "aeiou";



/** Swap two adjacent letters. */
function letterSwapEncrypt(word: string, pos: number): string {
  const chars = [...word];
  const safePos = Math.min(pos, chars.length - 2);
  [chars[safePos], chars[safePos + 1]] = [chars[safePos + 1], chars[safePos]];
  return chars.join("");
}

/** Remove vowels from a word, replacing with underscores. */
function removeVowelsEncrypt(word: string): string {
  return word.split("").map((ch) => (VOWELS.includes(ch) ? "_" : ch)).join("");
}

/** Scramble letters (Fisher-Yates), ensuring result differs from original. */
function scrambleEncrypt(word: string): string {
  const chars = [...word];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const result = chars.join("");
  // If scramble produced the same word, swap first two chars
  if (result === word && word.length >= 2) {
    [chars[0], chars[1]] = [chars[1], chars[0]];
    return chars.join("");
  }
  return result;
}

/** Encrypt a word using the given method. */
function encrypt(word: string, method: CipherMethod, rotN: number): string {
  switch (method) {
    case "letter-swap":
      return letterSwapEncrypt(word, rotN);
    case "remove-vowels":
      return removeVowelsEncrypt(word);
    case "scramble":
      return scrambleEncrypt(word);
  }
}

/** Build the method label shown to the player. */
function buildMethodLabel(method: CipherMethod, rotN: number): string {
  switch (method) {
    case "letter-swap":
      return `SWAP positions ${rotN + 1} and ${rotN + 2}`;
    case "remove-vowels":
      return "VOWELS REMOVED";
    case "scramble":
      return "LETTERS SCRAMBLED";
  }
}

/** Build help text lines. */
function buildExamples(method: CipherMethod, rotN: number): string[] {
  switch (method) {
    case "letter-swap":
      return [
        `Letters at positions ${rotN + 1} and ${rotN + 2} have been swapped`,
        "To decode: swap them back",
      ];
    case "remove-vowels":
      return [
        "All vowels (a, e, i, o, u) replaced with _",
        "To decode: fill in the missing vowels",
      ];
    case "scramble":
      return [
        "All letters are present but in wrong order",
        "To decode: figure out the original tech word",
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
  if (difficulty < 0.2) return "letter-swap";
  if (difficulty < 0.5) return "remove-vowels";
  return "scramble";
}

function pickRotN(_difficulty: number, method: CipherMethod, wordLength: number): number {
  if (method === "letter-swap") {
    return Math.floor(Math.random() * Math.max(1, wordLength - 1));
  }
  if (method === "remove-vowels" || method === "scramble") {
    return 0; // not used
  }
  // ROT: keep small — 1-3 only
  return Math.floor(Math.random() * 3) + 1;
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Alphabet chart component (shown for ROT ciphers)
// ---------------------------------------------------------------------------

// AlphabetChart lives only in CipherCrackV2 — V1 uses simple ciphers only

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CipherCrack(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("cipher-crack", props);

  const resolvedRef = useRef(false);

  // Touch device: hidden input for system keyboard
  const isTouch = useTouchDevice();
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isTouch && hiddenInputRef.current) {
      setTimeout(() => hiddenInputRef.current?.focus(), 300);
    }
  }, [isTouch]);

  // Cipher Hint meta upgrade: show first letter of answer
  const extraHintLetter = useMemo(() => {
    const hint = activePowerUps.find(
      (p) => p.effect.type === "extra-hint" && p.effect.minigame === "cipher-crack",
    );
    return hint ? hint.effect.value : 0;
  }, [activePowerUps]);

  // Decode Assist: fraction of letters pre-filled
  const decodeAssistFraction = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "cipher-crack",
    );
    return pu ? pu.effect.value : 0;
  }, [activePowerUps]);

  // Generate puzzle on mount
  const puzzle = useMemo(() => {
    const pool = getWordPool(difficulty);
    const word = pickOne(pool);
    const method = pickMethod(difficulty);
    const rotN = pickRotN(difficulty, method, word.length);
    const encrypted = encrypt(word, method, rotN);
    const methodLabel = buildMethodLabel(method, rotN);
    const examples = buildExamples(method, rotN);
    return { word, encrypted, methodLabel, examples, method, rotN };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute pre-filled positions for Decode Assist (stable on mount)
  const preFilledPositions = useMemo(() => {
    if (decodeAssistFraction <= 0) return new Set<number>();
    const count = Math.ceil(puzzle.word.length * decodeAssistFraction);
    // Pick random positions
    const indices = Array.from({ length: puzzle.word.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return new Set(indices.slice(0, count));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: find next non-pre-filled position starting from `from`
  const nextTypableIndex = useCallback(
    (from: number): number => {
      let idx = from;
      while (idx < puzzle.word.length && preFilledPositions.has(idx)) idx++;
      return idx;
    },
    [puzzle.word.length, preFilledPositions],
  );

  // Current typed character index (starts at first non-pre-filled position)
  const [charIndex, setCharIndex] = useState(() => {
    let idx = 0;
    while (idx < puzzle.word.length && preFilledPositions.has(idx)) idx++;
    return idx;
  });
  const charIndexRef = useRef(charIndex);

  useEffect(() => {
    charIndexRef.current = charIndex;
  }, [charIndex]);

  // Check if all positions are pre-filled (auto-complete)
  useEffect(() => {
    if (charIndex >= puzzle.word.length && !resolvedRef.current) {
      resolvedRef.current = true;
      complete(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive || resolvedRef.current) return;

      const key = e.key.toLowerCase();
      if (key.length !== 1 || key < "a" || key > "z") return;

      e.preventDefault();

      const ci = charIndexRef.current;
      if (ci >= puzzle.word.length) return;
      const expected = puzzle.word[ci];

      if (key === expected) {
        const nextChar = nextTypableIndex(ci + 1);
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
    [isActive, puzzle.word, complete, fail, nextTypableIndex],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Build per-character display: pre-filled (green), typed (green), cursor, remaining (_)
  const charDisplay = puzzle.word.split("").map((ch, i) => {
    if (preFilledPositions.has(i)) return { char: ch, state: "prefilled" as const };
    if (i < charIndex) return { char: ch, state: "typed" as const };
    if (i === charIndex) return { char: "_", state: "cursor" as const };
    return { char: "_", state: "remaining" as const };
  });
  // V1 never uses ROT — no alphabet chart needed

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

        {/* Alphabet chart for ROT ciphers */}
        {/* Alphabet chart only in V2 — V1 uses simple ciphers */}

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
            {charDisplay.map((cd, i) => {
              if (cd.state === "prefilled") {
                return <span key={i} className="text-cyber-green/70 font-bold">{cd.char}</span>;
              }
              if (cd.state === "typed") {
                return <span key={i} className="text-cyber-green font-bold">{cd.char}</span>;
              }
              if (cd.state === "cursor") {
                return (
                  <span key={i} className="relative">
                    <span className="inline-block w-[2px] h-8 sm:h-10 bg-cyber-cyan animate-pulse mx-0.5" />
                    <span className="text-white/15 font-bold">_</span>
                  </span>
                );
              }
              return <span key={i} className="text-white/15 font-bold">_</span>;
            })}
          </div>
        </div>

        <p className="text-white/40 text-xs uppercase tracking-widest">
          {charIndex >= puzzle.word.length ? puzzle.word.length : charIndex}/{puzzle.word.length}
          {preFilledPositions.size > 0 && (
            <span className="text-cyber-green/50 ml-2">({preFilledPositions.size} pre-filled)</span>
          )}
        </p>
      </div>

      {/* Hidden test helper: expected character */}
      <span data-testid="expected-char" data-char={charIndex < puzzle.word.length ? puzzle.word[charIndex] : ""} className="hidden" />

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

      <div className="desktop-only mt-6 text-center">
        <p className="text-white/40 text-xs uppercase tracking-widest">
          Type the decrypted word &mdash; wrong key = fail
        </p>
      </div>

      <div className="touch-only mt-6 text-center">
        <button
          type="button"
          className="px-4 py-2 border border-cyber-cyan/40 rounded-lg bg-cyber-cyan/10 text-cyber-cyan text-xs uppercase tracking-widest font-mono animate-pulse"
          onClick={() => hiddenInputRef.current?.focus()}
        >
          TAP HERE TO TYPE
        </button>
        <p className="text-white/40 text-xs uppercase tracking-widest mt-2">
          Type the decrypted word &mdash; wrong key = fail
        </p>
      </div>
    </div>
  );
}
