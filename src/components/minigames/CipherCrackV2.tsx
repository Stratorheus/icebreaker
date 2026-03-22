import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useTouchDevice } from "@/hooks/use-touch-device";
import { TimerBar } from "@/components/layout/TimerBar";
import { TECH_WORDS } from "@/data/words";

// ---------------------------------------------------------------------------
// Cipher helpers (duplicated from CipherCrack — tiny, not worth a shared file)
// ---------------------------------------------------------------------------

type CipherMethod = "rot";

/** Apply ROT-N encryption to a lowercase letter. */
function rotChar(ch: string, n: number): string {
  return String.fromCharCode(((ch.charCodeAt(0) - 97 + n) % 26 + 26) % 26 + 97);
}

/** Apply ROT-N to every letter in a word. */
function rotWord(word: string, n: number): string {
  return word.split("").map((ch) => rotChar(ch, n)).join("");
}

/** Encrypt a word — always plain ROT. */
function encrypt(word: string, _method: CipherMethod, rotN: number): string {
  return rotWord(word, rotN);
}

/** Build the method label. */
function buildMethodLabel(_method: CipherMethod, rotN: number): string {
  return `SHIFTED +${rotN}`;
}

/** Build help text. */
function buildExamples(_method: CipherMethod): string[] {
  return ["Use the alphabet chart below to decode each letter"];
}

// ---------------------------------------------------------------------------
// Word pool + method selection
// ---------------------------------------------------------------------------

function getWordPool(difficulty: number): readonly string[] {
  if (difficulty < 0.35) return TECH_WORDS.short;
  if (difficulty < 0.65) return [...TECH_WORDS.short, ...TECH_WORDS.medium];
  return [...TECH_WORDS.medium, ...TECH_WORDS.long];
}

function pickMethod(_difficulty: number): CipherMethod {
  return "rot";
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

function AlphabetChart({ rotN, showShiftMarker }: { rotN: number; showShiftMarker?: boolean }) {
  return (
    <div className="w-full max-w-md mx-auto mt-2 px-2">
      <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1 text-center">
        Alphabet reference (shift +{rotN})
        {showShiftMarker && (
          <span className="text-cyber-orange ml-2">
            ← {rotN} position{rotN > 1 ? "s" : ""} right
          </span>
        )}
      </p>
      <div className="grid grid-cols-13 gap-0 text-center font-mono text-[11px] leading-tight">
        {/* First row: original A-M */}
        {ALPHABET.slice(0, 13).split("").map((ch, i) => (
          <div key={`o1-${i}`} className="text-white/30 py-0.5">{ch}</div>
        ))}
        {/* Second row: shifted A-M, with shift marker on first N columns */}
        {ALPHABET.slice(0, 13).split("").map((ch, i) => {
          const shifted = String.fromCharCode(((ch.charCodeAt(0) - 65 + rotN) % 26) + 65);
          const isMarked = showShiftMarker && i < rotN;
          return (
            <div
              key={`s1-${i}`}
              className={`py-0.5 font-bold ${isMarked ? "text-cyber-orange bg-cyber-orange/15 rounded-sm" : "text-cyber-cyan/70"}`}
            >
              {shifted}
            </div>
          );
        })}
        {/* Third row: original N-Z */}
        {ALPHABET.slice(13).split("").map((ch, i) => (
          <div key={`o2-${i}`} className="text-white/30 py-0.5">{ch}</div>
        ))}
        {/* Fourth row: shifted N-Z */}
        {ALPHABET.slice(13).split("").map((ch, i) => {
          const shifted = String.fromCharCode(((ch.charCodeAt(0) - 65 + rotN) % 26) + 65);
          const isMarked = showShiftMarker && (13 + i) < rotN;
          return (
            <div
              key={`s2-${i}`}
              className={`py-0.5 font-bold ${isMarked ? "text-cyber-orange bg-cyber-orange/15 rounded-sm" : "text-cyber-cyan/70"}`}
            >
              {shifted}
            </div>
          );
        })}
      </div>
      <p className="text-white/20 text-[9px] text-center mt-1">
        Top = original, bottom = encrypted. Find encrypted letter on bottom, read original above.
      </p>
      {showShiftMarker && (
        <p className="text-cyber-orange/60 text-[9px] text-center mt-0.5">
          Shift marker: each letter shifts +{rotN} positions in the alphabet
        </p>
      )}
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

  // Touch device: hidden input for system keyboard
  const isTouch = useTouchDevice();
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isTouch && hiddenInputRef.current) {
      setTimeout(() => hiddenInputRef.current?.focus(), 300);
    }
  }, [isTouch]);

  // Shift Marker: highlights the shift offset in the alphabet chart
  const hasShiftMarker = useMemo(() => {
    return activePowerUps.some(
      (p) => p.effect.type === "minigame-specific" && p.effect.minigame === "cipher-crack-v2",
    );
  }, [activePowerUps]);

  // Auto-Decode V2: fraction of letters pre-filled (uses "hint" type)
  const autoDecodeFraction = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "hint" && p.effect.minigame === "cipher-crack-v2" && p.effect.value < 1,
    );
    return pu ? pu.effect.value : 0;
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

  // Compute pre-filled positions for Auto-Decode V2 (stable on mount)
  const preFilledPositions = useMemo(() => {
    if (autoDecodeFraction <= 0) return new Set<number>();
    const count = Math.ceil(puzzle.word.length * autoDecodeFraction);
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

  // Build per-character display for pre-filled positions
  const charDisplay = puzzle.word.split("").map((ch, i) => {
    if (preFilledPositions.has(i)) return { char: ch, state: "prefilled" as const };
    if (i < charIndex) return { char: ch, state: "typed" as const };
    if (i === charIndex) return { char: "_", state: "cursor" as const };
    return { char: "_", state: "remaining" as const };
  });

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

        {/* Alphabet chart -- always shown, with optional shift marker */}
        <AlphabetChart rotN={puzzle.rotN} showShiftMarker={hasShiftMarker} />

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
