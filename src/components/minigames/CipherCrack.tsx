import { useMemo } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useCipherMinigame } from "@/hooks/use-cipher-minigame";
import { MinigameShell } from "@/components/layout/MinigameShell";
import { HiddenMobileInput } from "@/components/layout/HiddenMobileInput";
import { CipherDisplay } from "@/components/layout/CipherDisplay";
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
// Component
// ---------------------------------------------------------------------------

export function CipherCrack(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("cipher-crack", props);

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

  // Shared cipher hook
  const cipher = useCipherMinigame({
    word: puzzle.word,
    preFilledFraction: decodeAssistFraction,
    isActive,
    onComplete: complete,
    onFail: fail,
  });

  return (
    <MinigameShell
      timer={timer}
      gap="gap-4"
      desktopHint={
        <p className="text-white/40 text-xs uppercase tracking-widest">
          Type the decrypted word &mdash; wrong key = fail
        </p>
      }
      touchHint={
        <>
          <HiddenMobileInput
            inputRef={cipher.hiddenInputRef}
            onInput={cipher.handleHiddenInput}
          />
          <p className="text-white/40 text-xs uppercase tracking-widest mt-2">
            Type the decrypted word &mdash; wrong key = fail
          </p>
        </>
      }
    >
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

      {/* Character display */}
      <CipherDisplay
        charDisplay={cipher.charDisplay}
        charIndex={cipher.charIndex}
        wordLength={puzzle.word.length}
        preFilledCount={cipher.preFilledPositions.size}
      />

      {/* Hidden test helper: expected character */}
      <span data-testid="expected-char" data-char={cipher.charIndex < puzzle.word.length ? puzzle.word[cipher.charIndex] : ""} className="hidden" />
    </MinigameShell>
  );
}
