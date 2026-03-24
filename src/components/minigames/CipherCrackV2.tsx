import { useMemo } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useCipherMinigame } from "@/hooks/use-cipher-minigame";
import { MinigameShell } from "@/components/layout/MinigameShell";
import { HiddenMobileInput } from "@/components/layout/HiddenMobileInput";
import { CipherDisplay } from "@/components/layout/CipherDisplay";
import { TECH_WORDS } from "@/data/words";

// ---------------------------------------------------------------------------
// Cipher helpers (ROT only)
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
// Alphabet chart component
// ---------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function AlphabetChart({ rotN, showShiftMarker, highlightEncrypted, highlightDecrypted }: {
  rotN: number;
  showShiftMarker?: boolean;
  highlightEncrypted?: string;
  highlightDecrypted?: string;
}) {
  // Example pair for shift marker: A → shifted letter
  const examplePlain = "A";
  const exampleShifted = String.fromCharCode(((0 + rotN) % 26) + 65);

  return (
    <div className="w-full max-w-md mx-auto mt-2 px-2">
      {/* Prominent ROT label when shift marker is active */}
      {showShiftMarker && (
        <div className="flex items-center justify-center gap-3 mb-2 py-1.5 px-3 border border-cyber-orange/30 bg-cyber-orange/[0.06] rounded">
          <span className="text-cyber-orange font-mono font-bold text-sm tracking-wider">
            ROT-{rotN}
          </span>
          <span className="text-white/40 text-[10px]">|</span>
          <span className="text-cyber-orange/80 text-[11px] font-mono">
            {examplePlain} → {exampleShifted}
          </span>
          <span className="text-white/40 text-[10px]">|</span>
          <span className="text-white/40 text-[10px] uppercase tracking-wider">
            shift {rotN} right
          </span>
        </div>
      )}

      <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1 text-center">
        Alphabet reference (shift +{rotN})
      </p>
      <div className="grid grid-cols-13 gap-0 text-center font-mono text-[11px] leading-tight">
        {/* First row: original A-M (decrypted = what to type) */}
        {ALPHABET.slice(0, 13).split("").map((ch, i) => {
          const isHighlight = showShiftMarker && highlightDecrypted === ch;
          return (
            <div key={`o1-${i}`} className={`py-0.5 ${isHighlight ? "text-cyber-green font-bold bg-cyber-green/15 rounded-sm" : showShiftMarker ? "text-white/25" : "text-white/30"}`}>{ch}</div>
          );
        })}
        {/* Second row: shifted A-M (encrypted = what you see) */}
        {ALPHABET.slice(0, 13).split("").map((ch, i) => {
          const shifted = String.fromCharCode(((ch.charCodeAt(0) - 65 + rotN) % 26) + 65);
          const isHighlight = showShiftMarker && highlightEncrypted === shifted;
          return (
            <div
              key={`s1-${i}`}
              className={`py-0.5 font-bold ${isHighlight ? "text-cyber-orange bg-cyber-orange/20 rounded-sm" : showShiftMarker ? "text-white/20" : "text-cyber-cyan/70"}`}
            >
              {shifted}
            </div>
          );
        })}
        {/* Third row: original N-Z */}
        {ALPHABET.slice(13).split("").map((ch, i) => {
          const isHighlight = showShiftMarker && highlightDecrypted === ch;
          return (
            <div key={`o2-${i}`} className={`py-0.5 ${isHighlight ? "text-cyber-green font-bold bg-cyber-green/15 rounded-sm" : showShiftMarker ? "text-white/25" : "text-white/30"}`}>{ch}</div>
          );
        })}
        {/* Fourth row: shifted N-Z */}
        {ALPHABET.slice(13).split("").map((ch, i) => {
          const shifted = String.fromCharCode(((ch.charCodeAt(0) - 65 + rotN) % 26) + 65);
          const isHighlight = showShiftMarker && highlightEncrypted === shifted;
          return (
            <div
              key={`s2-${i}`}
              className={`py-0.5 font-bold ${isHighlight ? "text-cyber-orange bg-cyber-orange/20 rounded-sm" : showShiftMarker ? "text-white/20" : "text-cyber-cyan/70"}`}
            >
              {shifted}
            </div>
          );
        })}
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

export function CipherCrackV2(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("cipher-crack-v2", props);

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

  // Shared cipher hook
  const cipher = useCipherMinigame({
    word: puzzle.word,
    preFilledFraction: autoDecodeFraction,
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

      {/* Alphabet chart -- always shown, with optional shift marker */}
      <AlphabetChart
        rotN={puzzle.rotN}
        showShiftMarker={hasShiftMarker}
        highlightEncrypted={hasShiftMarker && cipher.charIndex < puzzle.encrypted.length ? puzzle.encrypted[cipher.charIndex].toUpperCase() : undefined}
        highlightDecrypted={hasShiftMarker && cipher.charIndex < puzzle.word.length ? puzzle.word[cipher.charIndex].toUpperCase() : undefined}
      />

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
