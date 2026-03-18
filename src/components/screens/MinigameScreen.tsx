import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { TimerBar } from "@/components/layout/TimerBar";
import type { MinigameResult } from "@/types/minigame";

type Phase = "countdown" | "active" | "result";

/**
 * MinigameScreen — manages the minigame lifecycle:
 *   1. Countdown (2 s)
 *   2. Active minigame (placeholder auto-completes after 2 s)
 *   3. Result flash (1 s)
 *   4. Transition to next minigame or shop
 */
export function MinigameScreen() {
  const floorMinigames = useGameStore((s) => s.floorMinigames);
  const currentMinigameIndex = useGameStore((s) => s.currentMinigameIndex);
  const completeMinigame = useGameStore((s) => s.completeMinigame);
  const failMinigame = useGameStore((s) => s.failMinigame);
  const floor = useGameStore((s) => s.floor);

  const currentMinigame = floorMinigames[currentMinigameIndex];

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdownValue, setCountdownValue] = useState(3);
  const [lastResult, setLastResult] = useState<boolean | null>(null);

  // Track which minigame index we're rendering to reset phase on transition
  const prevIndexRef = useRef(currentMinigameIndex);

  // Reset phase when minigame index changes (next minigame in floor)
  useEffect(() => {
    if (prevIndexRef.current !== currentMinigameIndex) {
      prevIndexRef.current = currentMinigameIndex;
      setPhase("countdown");
      setCountdownValue(3);
      setLastResult(null);
    }
  }, [currentMinigameIndex]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdownValue <= 0) {
      setPhase("active");
      return;
    }

    const timer = setTimeout(() => {
      setCountdownValue((v) => v - 1);
    }, 666); // ~2 seconds for 3-2-1

    return () => clearTimeout(timer);
  }, [phase, countdownValue]);

  // Handle minigame completion
  const handleComplete = useCallback(
    (result: MinigameResult) => {
      setLastResult(result.success);
      setPhase("result");

      // After 1-second result flash, dispatch to store
      setTimeout(() => {
        if (result.success) {
          completeMinigame(result);
        } else {
          failMinigame();
        }
      }, 1000);
    },
    [completeMinigame, failMinigame],
  );

  return (
    <div className="min-h-screen flex flex-col pt-12">
      {/* Timer bar below HUD */}
      <TimerBar progress={phase === "active" ? 0.7 : 1} className="mx-4" />

      {/* Phase content */}
      <div className="flex-1 flex items-center justify-center px-4">
        {phase === "countdown" && (
          <CountdownPhase
            minigameName={formatMinigameName(currentMinigame)}
            value={countdownValue}
            floor={floor}
            index={currentMinigameIndex}
            total={floorMinigames.length}
          />
        )}

        {phase === "active" && (
          <PlaceholderMinigame
            minigameName={formatMinigameName(currentMinigame)}
            minigameType={currentMinigame}
            onComplete={handleComplete}
          />
        )}

        {phase === "result" && <ResultFlash success={lastResult ?? false} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Countdown phase
// ---------------------------------------------------------------------------

function CountdownPhase({
  minigameName,
  value,
  floor,
  index,
  total,
}: {
  minigameName: string;
  value: number;
  floor: number;
  index: number;
  total: number;
}) {
  return (
    <div className="text-center select-none">
      <p className="text-white/30 text-xs uppercase tracking-widest mb-4">
        FLOOR {floor} // MINIGAME {index + 1} OF {total}
      </p>
      <h2 className="text-3xl sm:text-5xl font-bold uppercase tracking-wider text-cyber-cyan mb-8">
        {minigameName}
      </h2>
      <p className="text-6xl sm:text-8xl font-bold text-white/80 tabular-nums">
        {value > 0 ? value : "GO"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder minigame (auto-completes after 2 s)
// ---------------------------------------------------------------------------

function PlaceholderMinigame({
  minigameName,
  minigameType,
  onComplete,
}: {
  minigameName: string;
  minigameType: string;
  onComplete: (result: MinigameResult) => void;
}) {
  const completedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;

      onComplete({
        success: true,
        timeMs: 2000,
        minigame: minigameType as MinigameResult["minigame"],
      });
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-center select-none">
      <h2 className="text-2xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan mb-6">
        {minigameName}
      </h2>
      <div className="flex items-center justify-center gap-2 text-cyber-magenta/60 text-sm uppercase tracking-widest">
        <span className="inline-block w-2 h-2 bg-cyber-magenta/60 rounded-full animate-pulse" />
        SIMULATING...
      </div>
      <p className="mt-6 text-white/20 text-xs uppercase tracking-widest">
        {">"}_&nbsp;PLACEHOLDER — REAL MINIGAME COMING SOON
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result flash
// ---------------------------------------------------------------------------

function ResultFlash({ success }: { success: boolean }) {
  return (
    <div className="text-center select-none">
      <h2
        className={`text-5xl sm:text-7xl font-bold uppercase tracking-wider ${
          success ? "text-cyber-cyan" : "text-cyber-magenta"
        }`}
      >
        {success ? "SUCCESS" : "FAILED"}
      </h2>
      <p className="mt-4 text-white/30 text-sm uppercase tracking-widest">
        {success ? "BREACH COMPLETE" : "INTRUSION BLOCKED"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinigameName(type: string): string {
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
