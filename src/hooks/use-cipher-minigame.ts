import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTouchDevice } from "@/hooks/use-touch-device";

export interface CipherCharDisplay {
  char: string;
  state: "prefilled" | "typed" | "cursor" | "remaining";
}

interface UseCipherMinigameProps {
  word: string;
  preFilledFraction: number;
  isActive: boolean;
  onComplete: (success: boolean) => void;
  onFail: () => void;
}

export interface UseCipherMinigameReturn {
  charIndex: number;
  preFilledPositions: Set<number>;
  charDisplay: CipherCharDisplay[];
  hiddenInputRef: React.RefObject<HTMLInputElement | null>;
  isTouch: boolean;
  handleHiddenInput: (e: React.FormEvent<HTMLInputElement>) => void;
}

/**
 * Shared hook for CipherCrack and CipherCrackV2.
 *
 * Encapsulates:
 * - Pre-filled position computation
 * - Character-by-character typing mechanic (correct = advance, wrong = fail)
 * - charDisplay array for rendering
 * - Hidden input + touch device setup
 */
export function useCipherMinigame({
  word,
  preFilledFraction,
  isActive,
  onComplete,
  onFail,
}: UseCipherMinigameProps): UseCipherMinigameReturn {
  const resolvedRef = useRef(false);

  // Touch device: hidden input for system keyboard
  const isTouch = useTouchDevice();
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isTouch && hiddenInputRef.current) {
      setTimeout(() => hiddenInputRef.current?.focus(), 300);
    }
  }, [isTouch]);

  // Compute pre-filled positions (stable on mount)
  const preFilledPositions = useMemo(() => {
    if (preFilledFraction <= 0) return new Set<number>();
    const count = Math.ceil(word.length * preFilledFraction);
    const indices = Array.from({ length: word.length }, (_, i) => i);
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
      while (idx < word.length && preFilledPositions.has(idx)) idx++;
      return idx;
    },
    [word.length, preFilledPositions],
  );

  // Current typed character index (starts at first non-pre-filled position)
  const [charIndex, setCharIndex] = useState(() => {
    let idx = 0;
    while (idx < word.length && preFilledPositions.has(idx)) idx++;
    return idx;
  });
  const charIndexRef = useRef(charIndex);

  useEffect(() => {
    charIndexRef.current = charIndex;
  }, [charIndex]);

  // Check if all positions are pre-filled (auto-complete)
  useEffect(() => {
    if (charIndex >= word.length && !resolvedRef.current) {
      resolvedRef.current = true;
      onComplete(true);
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
      if (ci >= word.length) return;
      const expected = word[ci];

      if (key === expected) {
        const nextChar = nextTypableIndex(ci + 1);
        if (nextChar >= word.length) {
          resolvedRef.current = true;
          onComplete(true);
        } else {
          setCharIndex(nextChar);
        }
      } else {
        resolvedRef.current = true;
        onFail();
      }
    },
    [isActive, word, onComplete, onFail, nextTypableIndex],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Build per-character display
  const charDisplay: CipherCharDisplay[] = word.split("").map((ch, i) => {
    if (preFilledPositions.has(i)) return { char: ch, state: "prefilled" as const };
    if (i < charIndex) return { char: ch, state: "typed" as const };
    if (i === charIndex) return { char: "_", state: "cursor" as const };
    return { char: "_", state: "remaining" as const };
  });

  // Hidden input handler
  const handleHiddenInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    for (const char of target.value) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
    }
    target.value = "";
  }, []);

  return {
    charIndex,
    preFilledPositions,
    charDisplay,
    hiddenInputRef,
    isTouch,
    handleHiddenInput,
  };
}
