import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { TimerBar } from "@/components/layout/TimerBar";
import type { MinigameResult } from "@/types/minigame";
import type { MinigameType, PowerUpInstance } from "@/types/game";
import { getDifficulty, getTimeLimit } from "@/data/balancing";
import { checkSkip } from "@/lib/power-up-effects";
import { awardNewAchievements } from "@/hooks/use-achievement-check";
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
  const inventory = useGameStore((s) => s.inventory);
  const usePowerUp = useGameStore((s) => s.usePowerUp);
  const purchasedUpgrades = useGameStore((s) => s.purchasedUpgrades);
  const recordMinigameResult = useGameStore((s) => s.recordMinigameResult);
  const bonusTimeSecs = useGameStore((s) => s.bonusTimeSecs);

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

  // Countdown timer — with skip check at the moment we would go "active"
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdownValue <= 0) {
      // Check for skip power-up just before transitioning to active
      const skipResult = checkSkip(inventory);
      if (skipResult.skip && skipResult.consumeId) {
        // Consume the power-up
        usePowerUp(skipResult.consumeId);
        // Auto-complete the minigame as a success (skip = no penalty)
        setLastResult(true);
        setPhase("result");
        setTimeout(() => {
          completeMinigame({
            success: true,
            timeMs: 0,
            minigame: currentMinigame,
          });
        }, 1000);
        return;
      }

      setPhase("active");
      return;
    }

    const timer = setTimeout(() => {
      setCountdownValue((v) => v - 1);
    }, 666); // ~2 seconds for 3-2-1

    return () => clearTimeout(timer);
  }, [phase, countdownValue, inventory, usePowerUp, completeMinigame, currentMinigame]);

  // Handle minigame completion
  const handleComplete = useCallback(
    (result: MinigameResult) => {
      setLastResult(result.success);
      setPhase("result");

      // After 1-second result flash, dispatch to store
      setTimeout(() => {
        // Record minigame result for streak/total tracking first
        recordMinigameResult(result.minigame, result.success);

        if (result.success) {
          completeMinigame(result);
        } else {
          failMinigame();
        }

        // Check achievements after store state is updated
        // (Zustand set() is synchronous so state is fresh here)
        awardNewAchievements({
          success: result.success,
          timeMs: result.timeMs,
          type: result.minigame,
        });
      }, 1000);
    },
    [completeMinigame, failMinigame, recordMinigameResult],
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
            bonusTimeSecs={floor === 1 ? bonusTimeSecs : 0}
            purchasedUpgrades={purchasedUpgrades}
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

/**
 * Build synthetic PowerUpInstances from meta upgrades that apply to a specific
 * minigame type, so they are passed through the standard `activePowerUps` API.
 *
 * These use the effect types already defined in PowerUpEffect but sourced from
 * purchasedUpgrades (persistent meta progress) rather than the run inventory.
 */
function buildMetaPowerUps(
  purchasedUpgrades: Record<string, number>,
  type: MinigameType,
): PowerUpInstance[] {
  const synth: PowerUpInstance[] = [];

  // Helper: add a synthetic power-up if the upgrade tier > 0
  function addIfOwned(
    upgradeId: string,
    effectType: PowerUpInstance["effect"]["type"],
    valueByTier: number[],
    minigame?: MinigameType,
  ) {
    const tier = purchasedUpgrades[upgradeId] ?? 0;
    if (tier <= 0) return;
    const value = valueByTier[tier - 1] ?? valueByTier[valueByTier.length - 1];
    synth.push({
      id: `meta-${upgradeId}`,
      type: `meta-${upgradeId}`,
      name: upgradeId,
      description: "",
      effect: { type: effectType, value, minigame },
    });
  }

  switch (type) {
    case "close-brackets":
      // bracket-reducer → bracket-type-removal (1 bracket type removed)
      addIfOwned("bracket-reducer", "minigame-specific", [1], "close-brackets");
      // bracket-mirror → auto-close repurposed as flash signal (value = 0.3 s)
      addIfOwned("bracket-mirror", "auto-close", [0.3], "close-brackets");
      break;

    case "mine-sweep":
      // mine-echo → mines-visible (1 / 2 / 3 mines shown during preview)
      addIfOwned("mine-echo", "minigame-specific", [1, 2, 3], "mine-sweep");
      break;

    case "find-symbol":
      // symbol-scanner → hint (proximity blink)
      addIfOwned("symbol-scanner", "hint", [1], "find-symbol");
      // symbol-magnifier → minigame-specific (scale value 1.3)
      addIfOwned("symbol-magnifier", "minigame-specific", [1], "find-symbol");
      break;

    case "match-arrows":
      // arrow-preview → reveal-first (1 / 2 / 3 pre-revealed)
      addIfOwned("arrow-preview", "reveal-first", [1, 2, 3], "match-arrows");
      break;

    case "type-backward":
      // type-assist → hint (first letter shown)
      addIfOwned("type-assist", "hint", [1], "type-backward");
      // reverse-trainer → minigame-specific (word length shown)
      addIfOwned("reverse-trainer", "minigame-specific", [1], "type-backward");
      break;

    case "wire-cutting":
      // wire-labels → hint (color labels)
      addIfOwned("wire-labels", "hint", [1], "wire-cutting");
      // wire-schematic → preview (preview duration ms, encoded as value)
      addIfOwned("wire-schematic", "preview", [1500], "wire-cutting");
      break;

    case "cipher-crack":
      // cipher-hint → hint (extra letter)
      addIfOwned("cipher-hint", "hint", [1], "cipher-crack");
      break;

    case "slash-timing":
      // slash-window → window-extend (0.25 wider)
      addIfOwned("slash-window", "window-extend", [0.25], "slash-timing");
      break;
  }

  return synth;
}

function MinigameRouter({
  type,
  floor,
  bonusTimeSecs,
  purchasedUpgrades,
  onComplete,
}: {
  type: MinigameType;
  floor: number;
  bonusTimeSecs: number;
  purchasedUpgrades: Record<string, number>;
  onComplete: (result: MinigameResult) => void;
}) {
  const inventory = useGameStore((s) => s.inventory);
  const difficulty = getDifficulty(floor);
  const timeLimit = getTimeLimit(BASE_TIME_LIMITS[type], difficulty) + bonusTimeSecs;
  const Component = MINIGAME_COMPONENTS[type];

  // Merge run-time inventory power-ups with meta upgrade synthetics
  const metaPowerUps = useMemo(
    () => buildMetaPowerUps(purchasedUpgrades, type),
    // purchasedUpgrades is a stable reference from the store (changes only in meta-shop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type],
  );

  const activePowerUps = useMemo(
    () => [...inventory, ...metaPowerUps],
    [inventory, metaPowerUps],
  );

  return (
    <Component
      difficulty={difficulty}
      timeLimit={timeLimit}
      activePowerUps={activePowerUps}
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
