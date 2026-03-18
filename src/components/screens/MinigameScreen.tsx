import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { TimerBar } from "@/components/layout/TimerBar";
import type { MinigameResult } from "@/types/minigame";
import type { MinigameType } from "@/types/game";
import { getDifficulty, getTimeLimit } from "@/data/balancing";
import { SlashTiming } from "@/components/minigames/SlashTiming";
import { CloseBrackets } from "@/components/minigames/CloseBrackets";
import { TypeBackward } from "@/components/minigames/TypeBackward";
import { MatchArrows } from "@/components/minigames/MatchArrows";
import { FindSymbol } from "@/components/minigames/FindSymbol";
import { MineSweep } from "@/components/minigames/MineSweep";
import { WireCutting } from "@/components/minigames/WireCutting";
import { CipherCrack } from "@/components/minigames/CipherCrack";

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
          <MinigameRouter
            type={currentMinigame}
            floor={floor}
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
// Minigame router — renders the correct component by type
// ---------------------------------------------------------------------------

const BASE_TIME_LIMITS: Record<MinigameType, number> = {
  "slash-timing": 12,
  "close-brackets": 15,
  "type-backward": 20,
  "match-arrows": 15,
  "find-symbol": 20,
  "mine-sweep": 25,
  "wire-cutting": 20,
  "cipher-crack": 20,
};

const MINIGAME_COMPONENTS: Record<MinigameType, React.ComponentType<import("@/types/minigame").MinigameProps>> = {
  "slash-timing": SlashTiming,
  "close-brackets": CloseBrackets,
  "type-backward": TypeBackward,
  "match-arrows": MatchArrows,
  "find-symbol": FindSymbol,
  "mine-sweep": MineSweep,
  "wire-cutting": WireCutting,
  "cipher-crack": CipherCrack,
};

function MinigameRouter({
  type,
  floor,
  onComplete,
}: {
  type: MinigameType;
  floor: number;
  onComplete: (result: MinigameResult) => void;
}) {
  const inventory = useGameStore((s) => s.inventory);
  const difficulty = getDifficulty(floor);
  const timeLimit = getTimeLimit(BASE_TIME_LIMITS[type], difficulty);
  const Component = MINIGAME_COMPONENTS[type];

  return (
    <Component
      difficulty={difficulty}
      timeLimit={timeLimit}
      activePowerUps={inventory}
      onComplete={onComplete}
    />
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
