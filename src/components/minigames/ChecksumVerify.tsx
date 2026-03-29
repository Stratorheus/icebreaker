import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MinigameProps } from "@/types/minigame";
import { useMinigame } from "@/hooks/use-minigame";
import { useTouchDevice } from "@/hooks/use-touch-device";
import { useKeyboard } from "@/hooks/use-keyboard";
import { MinigameShell } from "@/components/layout/MinigameShell";
import { HiddenMobileInput } from "@/components/layout/HiddenMobileInput";
import { ProgressDots } from "@/components/layout/ProgressDots";

// -- Expression generation ----------------------------------------------------

interface Expression {
  display: string;
  answer: number;
}

function generateExpression(difficulty: number): Expression {
  if (difficulty <= 0.2) {
    // Trivial/Easy: single-digit add/subtract (3+5, 8-2)
    const a = Math.floor(Math.random() * 9) + 1; // 1-9
    const op = Math.random() < 0.5 ? "+" : "-";
    const b =
      op === "+"
        ? Math.floor(Math.random() * 9) + 1 // 1-9
        : Math.floor(Math.random() * a) + 1; // 1..a (no negative results)
    const answer = op === "+" ? a + b : a - b;
    return { display: `${a} ${op} ${b}`, answer };
  }

  if (difficulty <= 0.55) {
    // Normal/Medium: two-digit +/- single-digit, occasional small multiplication
    if (Math.random() < 0.2) {
      // Small multiplication (2-5 × 2-5)
      const a = Math.floor(Math.random() * 4) + 2; // 2-5
      const b = Math.floor(Math.random() * 4) + 2; // 2-5
      return { display: `${a} \u00D7 ${b}`, answer: a * b };
    }
    const a = Math.floor(Math.random() * 90) + 10; // 10-99
    const op = Math.random() < 0.5 ? "+" : "-";
    const b = Math.floor(Math.random() * 9) + 1; // 1-9
    const answer = op === "+" ? a + b : a - b;
    return { display: `${a} ${op} ${b}`, answer };
  }

  if (difficulty <= 0.8) {
    // Hard/Expert: two-digit +/- two-digit (23+34, 51-18)
    const a = Math.floor(Math.random() * 90) + 10; // 10-99
    const op = Math.random() < 0.5 ? "+" : "-";
    const b = Math.floor(Math.random() * 90) + 10; // 10-99
    const answer = op === "+" ? a + b : a - b;
    return { display: `${a} ${op} ${b}`, answer };
  }

  // Insane: single-digit multiplication max 9×9 OR two-digit add
  if (Math.random() < 0.5) {
    const a = Math.floor(Math.random() * 8) + 2; // 2-9
    const b = Math.floor(Math.random() * 8) + 2; // 2-9
    return { display: `${a} \u00D7 ${b}`, answer: a * b };
  } else {
    const a = Math.floor(Math.random() * 90) + 10; // 10-99
    const b = Math.floor(Math.random() * 90) + 10; // 10-99
    return { display: `${a} + ${b}`, answer: a + b };
  }
}

function getExpressionCount(difficulty: number): number {
  if (difficulty <= 0.2) return 2;   // Trivial/Easy
  if (difficulty <= 0.55) return 3;  // Normal/Medium
  if (difficulty <= 0.8) return 4;   // Hard/Expert
  return 5;                          // Insane
}

// -- Component ----------------------------------------------------------------

/**
 * ChecksumVerify -- quick math minigame.
 *
 * Display a math expression, player types the answer. Multiple expressions
 * in series. Wrong answer on confirm = immediate fail. All correct = win.
 *
 * Difficulty scaling (0-1):
 *   Trivial/Easy (≤0.2):  single-digit add/subtract, 2 expressions
 *   Normal/Medium (≤0.55): two-digit +/- single-digit, occasional small ×, 3 expressions
 *   Hard/Expert (≤0.8):   two-digit +/- two-digit, 4 expressions
 *   Insane (>0.8):        single-digit multiplication or two-digit add, 5 expressions
 */
export function ChecksumVerify(props: MinigameProps) {
  const { difficulty, activePowerUps } = props;
  const { timer, complete, fail, isActive } = useMinigame("checksum-verify", props);

  const resolvedRef = useRef(false);

  // Touch device: hidden input for system keyboard
  const isTouch = useTouchDevice();
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isTouch && hiddenInputRef.current) {
      setTimeout(() => hiddenInputRef.current?.focus(), 300);
    }
  }, [isTouch]);

  // Error Margin: accept answers within ±N tolerance
  const errorTolerance = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "hint" && p.effect.minigame === "checksum-verify",
    );
    return pu ? pu.effect.value : 0;
  }, [activePowerUps]);

  // Range Hint: show answer range with fixed ±spread (10/5/3)
  const rangeHintSpread = useMemo(() => {
    const pu = activePowerUps.find(
      (p) => p.effect.type === "preview" && p.effect.minigame === "checksum-verify",
    );
    return pu ? pu.effect.value : 0;
  }, [activePowerUps]);

  // -- Generate all expressions on mount (stable) --
  const expressions = useMemo(() => {
    const count = getExpressionCount(difficulty);
    const exprs: Expression[] = [];
    for (let i = 0; i < count; i++) {
      exprs.push(generateExpression(difficulty));
    }
    return exprs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- State --
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const [input, setInput] = useState("");
  const inputRef = useRef("");
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Flash state for wrong/right feedback
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);

  // -- Confirm answer --
  const handleConfirm = useCallback(() => {
    if (!isActive || resolvedRef.current) return;

    const idx = currentIndexRef.current;
    const currentInput = inputRef.current.trim();

    // Ignore empty input
    if (currentInput === "" || currentInput === "-") return;

    const parsed = parseInt(currentInput, 10);
    if (isNaN(parsed)) return;

    const expected = expressions[idx].answer;
    const withinTolerance = errorTolerance > 0
      ? Math.abs(parsed - expected) <= errorTolerance
      : parsed === expected;

    if (!withinTolerance) {
      // Wrong answer -- immediate fail
      resolvedRef.current = true;
      setFlash("wrong");
      setTimeout(() => fail(), 400);
      return;
    }

    // Correct!
    setFlash("correct");
    const nextIndex = idx + 1;

    if (nextIndex >= expressions.length) {
      // All expressions done -- win!
      resolvedRef.current = true;
      timer.pause(); // prevent handleExpire from firing during the flash delay
      setTimeout(() => complete(true), 400);
    } else {
      // Move to next expression
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        currentIndexRef.current = nextIndex;
        setInput("");
        inputRef.current = "";
        setFlash(null);
      }, 300);
    }
  }, [isActive, expressions, fail, complete, errorTolerance, timer]);

  // -- Handle digit input --
  const handleDigit = useCallback(
    (digit: string) => {
      if (!isActive || resolvedRef.current) return;
      if (flash === "wrong" || flash === "correct") return;
      setInput((prev) => {
        const next = prev + digit;
        inputRef.current = next;
        return next;
      });
    },
    [isActive, flash],
  );

  // -- Handle minus (only at start) --
  const handleMinus = useCallback(() => {
    if (!isActive || resolvedRef.current) return;
    if (flash === "wrong" || flash === "correct") return;
    setInput((prev) => {
      if (prev === "") {
        inputRef.current = "-";
        return "-";
      }
      return prev; // ignore if not at start
    });
  }, [isActive, flash]);

  // -- Backspace --
  const handleBackspace = useCallback(() => {
    if (!isActive || resolvedRef.current) return;
    if (flash === "wrong" || flash === "correct") return;
    setInput((prev) => {
      const next = prev.slice(0, -1);
      inputRef.current = next;
      return next;
    });
  }, [isActive, flash]);

  // -- Keyboard bindings --
  const keyMap = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (let i = 0; i <= 9; i++) {
      const d = String(i);
      map[d] = () => handleDigit(d);
    }
    map["-"] = handleMinus;
    map["Backspace"] = handleBackspace;
    map["Enter"] = handleConfirm;
    map[" "] = handleConfirm;
    return map;
  }, [handleDigit, handleMinus, handleBackspace, handleConfirm]);

  useKeyboard(keyMap);

  // -- Cursor blink --
  const [cursorVisible, setCursorVisible] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Hidden input handler
  const handleHiddenInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    for (const char of target.value) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
    }
    target.value = "";
  }, []);

  // -- Render --
  const expr = expressions[currentIndex];

  const flashBg =
    flash === "correct"
      ? "bg-cyber-green/20 border-cyber-green/50"
      : flash === "wrong"
        ? "bg-cyber-magenta/20 border-cyber-magenta/50"
        : "bg-white/[0.03] border-white/10";

  return (
    <MinigameShell
      timer={timer}
      timerGap="mb-4"
      maxWidth="max-w-2xl"
      desktopHint={
        <div className="space-y-1">
          <p className="text-white/30 text-xs uppercase tracking-widest">
            Type digits, ENTER or SPACE to confirm
          </p>
          <div className="flex items-center justify-center gap-2">
            <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono">
              0-9
            </kbd>
            <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono">
              -
            </kbd>
            <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 font-mono">
              BKSP
            </kbd>
            <kbd className="px-2 py-1 bg-cyan-950/50 border border-cyan-800/30 rounded text-[10px] text-cyan-500/70 font-mono">
              ENTER
            </kbd>
            <kbd className="px-2 py-1 bg-cyan-950/50 border border-cyan-800/30 rounded text-[10px] text-cyan-500/70 font-mono">
              SPACE
            </kbd>
          </div>
        </div>
      }
      touchHint={
        <div className="space-y-2">
          <HiddenMobileInput
            inputRef={hiddenInputRef}
            onInput={handleHiddenInput}
            inputMode="numeric"
          />
          <div>
            <button
              type="button"
              className="px-6 py-2 border border-cyber-green/50 rounded-lg bg-cyber-green/10 text-cyber-green text-xs uppercase tracking-widest font-mono font-bold"
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
              }}
            >
              CONFIRM
            </button>
          </div>
          <p className="text-white/30 text-xs uppercase tracking-widest">
            Type digits, then CONFIRM
          </p>
        </div>
      }
    >
      {/* Header */}
      <p className="text-cyber-cyan text-xs uppercase tracking-widest font-mono glitch-subtle">
        Verifying Data Integrity...
      </p>

      {/* Progress */}
      <p className="text-white/50 text-sm font-mono tracking-wider">
        CHECKSUM {currentIndex + 1}/{expressions.length}
      </p>

      {/* Progress dots */}
      <ProgressDots
        total={expressions.length}
        current={currentIndex}
        activeIndex={currentIndex}
      />

      {/* Expression display */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="px-8 py-4 border border-cyan-800/50 bg-cyan-950/30 rounded-lg"
          style={{ boxShadow: "0 0 20px rgba(0, 255, 255, 0.1)" }}
        >
          <p
            className="text-4xl sm:text-5xl font-bold font-mono text-cyber-cyan tracking-wider"
            style={{ textShadow: "0 0 12px rgba(0, 255, 255, 0.4)" }}
          >
            {expr.display}
          </p>
        </div>

        {/* Range Hint: show answer range with fixed ±spread */}
        {rangeHintSpread > 0 && (() => {
          const lo = expr.answer - rangeHintSpread;
          const hi = expr.answer + rangeHintSpread;
          return (
            <p className="text-cyber-orange/60 text-xs font-mono uppercase tracking-wider">
              Answer is between {lo} and {hi}
            </p>
          );
        })()}

        {/* Error Margin indicator */}
        {errorTolerance > 0 && (
          <p className="text-cyber-green/50 text-[10px] font-mono uppercase tracking-wider">
            &plusmn;{errorTolerance} tolerance active
          </p>
        )}

        {/* Equals sign */}
        <p className="text-white/40 text-2xl font-mono">=</p>

        {/* Input area */}
        <div
          className={`
            min-w-[160px] px-6 py-3 border rounded-lg
            flex items-center justify-center
            transition-all duration-200
            ${flashBg}
          `}
        >
          <span className="text-3xl sm:text-4xl font-bold font-mono text-white tracking-wider">
            {input}
          </span>
          <span
            className={`
              text-3xl sm:text-4xl font-bold font-mono text-cyber-cyan
              transition-opacity duration-100
              ${cursorVisible && !flash ? "opacity-80" : "opacity-0"}
            `}
          >
            _
          </span>
        </div>
      </div>

      {/* Hidden test helper: expected answer */}
      <span data-testid="expected-answer" data-answer={expr.answer} className="hidden" />
    </MinigameShell>
  );
}
