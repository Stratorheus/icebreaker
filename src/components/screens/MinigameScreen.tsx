import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import type { MinigameResult } from "@/types/minigame";
import type { MinigameType } from "@/types/game";
import { getEffectiveCredits, getEffectiveDamage, getEffectiveDifficulty, getEffectiveTimeLimit } from "@/data/balancing";
import { MINIGAME_COMPONENTS, BASE_TIME_LIMITS, buildMetaPowerUps, STARTING_MINIGAMES, getMinigameDisplayName } from "@/data/minigames/registry";
import { checkSkip } from "@/lib/power-up-effects";
import { evaluateAndAwardAchievements } from "@/hooks/use-achievement-check";

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
  const skipRemainingFloor = useGameStore((s) => s.skipRemainingFloor);

  const currentMinigame = floorMinigames[currentMinigameIndex];

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdownValue, setCountdownValue] = useState(3);
  const [lastResult, setLastResult] = useState<boolean | null>(null);
  const [lastEarnedCredits, setLastEarnedCredits] = useState(0);
  const [lastHadSpeedBonus, setLastHadSpeedBonus] = useState(false);

  // Track the floorMinigames array reference to detect re-rolls (fail
  // replaces the entry at the same index, so the array ref changes).
  const prevIndexRef = useRef(currentMinigameIndex);
  const prevFloorMinigamesRef = useRef(floorMinigames);

  // Reset phase when minigame index changes (next minigame) OR when
  // floorMinigames array changes (re-roll after fail)
  useEffect(() => {
    if (
      prevIndexRef.current !== currentMinigameIndex ||
      prevFloorMinigamesRef.current !== floorMinigames
    ) {
      prevIndexRef.current = currentMinigameIndex;
      prevFloorMinigamesRef.current = floorMinigames;

      setCountdownValue(3);
      setPhase("countdown");
      setLastResult(null);
    }
  }, [currentMinigameIndex, floorMinigames]);

  // Countdown timer — with skip check at the moment we would go "active"
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdownValue <= 0) {
      // Check for skip power-up just before transitioning to active
      const skipResult = checkSkip(inventory);
      if (skipResult.skip && skipResult.consumeId) {
        // Consume the power-up
        usePowerUp(skipResult.consumeId);

        if (skipResult.skipFloor) {
          // Fix 2: Record minigame results for each remaining protocol
          const remaining = floorMinigames.slice(currentMinigameIndex);
          for (const mg of remaining) {
            recordMinigameResult(mg, true);
          }

          // Fix 5: Calculate earned credits for Warp Gate flash display
          if (skipResult.rewardFraction > 0) {
            const diff = getEffectiveDifficulty(floor, purchasedUpgrades["difficulty-reducer"] ?? 0);
            const unlockedCount = useGameStore.getState().unlockedMinigames.length;
            const unlockBonus = Math.max(0, unlockedCount - STARTING_MINIGAMES.length) * 0.05;
            const rawCredits = getEffectiveCredits(Infinity, diff, purchasedUpgrades["credit-multiplier"] ?? 0, purchasedUpgrades["speed-tax"] ?? 0, unlockBonus);
            setLastEarnedCredits(Math.round(rawCredits * skipResult.rewardFraction * remaining.length));
          } else {
            setLastEarnedCredits(0);
          }
          setLastHadSpeedBonus(false);

          // Fix 4: Show result flash first, then skip after 1 s (same pattern as single-skip)
          setLastResult(true);
          setPhase("result");
          setTimeout(() => {
            skipRemainingFloor(skipResult.rewardFraction);
            evaluateAndAwardAchievements();
          }, 1000);
          return;
        }

        // Single protocol skip (Backdoor or Null Route)
        // Fix 5: Calculate earned credits for single-skip flash display
        if (skipResult.rewardFraction > 0) {
          const diff = getEffectiveDifficulty(floor, purchasedUpgrades["difficulty-reducer"] ?? 0);
          const unlockedCount = useGameStore.getState().unlockedMinigames.length;
          const unlockBonus = Math.max(0, unlockedCount - STARTING_MINIGAMES.length) * 0.05;
          const rawCredits = getEffectiveCredits(Infinity, diff, purchasedUpgrades["credit-multiplier"] ?? 0, purchasedUpgrades["speed-tax"] ?? 0, unlockBonus);
          setLastEarnedCredits(Math.round(rawCredits * skipResult.rewardFraction));
        } else {
          setLastEarnedCredits(0);
        }
        setLastHadSpeedBonus(false);
        setLastResult(true);
        setPhase("result");
        setTimeout(() => {
          completeMinigame({
            success: true,
            timeMs: Infinity, // skips don't get speed bonus
            minigame: currentMinigame,
            rewardFraction: skipResult.rewardFraction,
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
  }, [phase, countdownValue, inventory, usePowerUp, completeMinigame, currentMinigame, skipRemainingFloor, recordMinigameResult, floorMinigames, currentMinigameIndex, floor, purchasedUpgrades]);

  // Handle minigame completion
  const handleComplete = useCallback(
    (result: MinigameResult) => {
      setLastResult(result.success);
      setPhase("result");

      // Calculate credits earned for success flash display
      let earnedCredits = 0;
      if (result.success) {
        const diff = getEffectiveDifficulty(floor, purchasedUpgrades["difficulty-reducer"] ?? 0);
        const unlockedCount = useGameStore.getState().unlockedMinigames.length;
        const unlockBonus = Math.max(0, unlockedCount - STARTING_MINIGAMES.length) * 0.05;
        earnedCredits = getEffectiveCredits(
          result.timeMs,
          diff,
          purchasedUpgrades["credit-multiplier"] ?? 0,
          purchasedUpgrades["speed-tax"] ?? 0,
          unlockBonus,
        );
        // Speed bonus applies when completing under 10 s (timeMs < 10000)
        const hasSpeedBonus = result.timeMs < 10000;
        setLastHadSpeedBonus(hasSpeedBonus);
      }
      setLastEarnedCredits(earnedCredits);

      // After 1-second result flash, dispatch to store
      setTimeout(() => {
        // Record minigame result for streak/total tracking first
        recordMinigameResult(result.minigame, result.success);

        if (result.success) {
          completeMinigame(result);
        } else {
          failMinigame();
        }

        // Consume minigame-specific run-shop power-ups (those with effect.minigame matching the current game).
        // Time-bonus power-ups persist through the entire floor (consumed in advanceFloor).
        // Deadline Override is single-use: consumed after the first minigame it's present for.
        const currentInventory = useGameStore.getState().inventory;
        const toConsume = currentInventory.filter(
          (p) =>
            (p.effect.minigame && p.effect.minigame === result.minigame) ||
            (p.effect.type === "deadline-override" && result.deadlineTriggered),
        );
        for (const pu of toConsume) {
          usePowerUp(pu.id);
        }

        // Check achievements after store state is updated
        // (Zustand set() is synchronous — lastMinigameResult is already in store)
        evaluateAndAwardAchievements();
      }, 1000);
    },
    [completeMinigame, failMinigame, recordMinigameResult, purchasedUpgrades, floor, usePowerUp],
  );

  return (
    <div className="min-h-screen flex flex-col pt-12">
      {/* Phase content */}
      <div className="flex-1 flex items-center justify-center px-4">
        {phase === "countdown" && (
          <CountdownPhase
            minigameName={getMinigameDisplayName(currentMinigame)}
            value={countdownValue}
            floor={floor}
            index={currentMinigameIndex}
            total={floorMinigames.length}
            purchasedUpgrades={purchasedUpgrades}
          />
        )}

        {phase === "active" && (
          <div data-testid="minigame-active">
            <MinigameRouter
              type={currentMinigame}
              floor={floor}
              purchasedUpgrades={purchasedUpgrades}
              onComplete={handleComplete}
            />
          </div>
        )}

        {phase === "result" && (
          <ResultFlash
            success={lastResult ?? false}
            earnedCredits={lastEarnedCredits}
            hadSpeedBonus={lastHadSpeedBonus}
          />
        )}
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
  purchasedUpgrades,
}: {
  minigameName: string;
  value: number;
  floor: number;
  index: number;
  total: number;
  purchasedUpgrades: Record<string, number>;
}) {
  const diff = getEffectiveDifficulty(floor, purchasedUpgrades["difficulty-reducer"] ?? 0);
  const approxCredits = Math.round(20 * (1 + diff));
  const damage = getEffectiveDamage(floor, purchasedUpgrades["thicker-armor"] ?? 0);

  return (
    <div className="text-center select-none">
      <p className="text-white/30 text-xs uppercase tracking-widest mb-4 glitch-subtle">
        FLOOR {floor} // PROTOCOL {index + 1} OF {total}
      </p>
      <h2 className="text-3xl sm:text-5xl font-heading uppercase tracking-wider text-cyber-cyan mb-8 glitch-text">
        {minigameName}
      </h2>
      <p className="text-6xl sm:text-8xl font-bold text-white/80 tabular-nums glitch-flicker">
        {value > 0 ? value : "GO"}
      </p>
      <p className="mt-4 text-xs text-white/30 font-mono uppercase tracking-widest">
        +{approxCredits} CR on success &nbsp;|&nbsp; -{damage} HP on fail
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minigame router — renders the correct component by type
// ---------------------------------------------------------------------------

function MinigameRouter({
  type,
  floor,
  purchasedUpgrades,
  onComplete,
}: {
  type: MinigameType;
  floor: number;
  purchasedUpgrades: Record<string, number>;
  onComplete: (result: MinigameResult) => void;
}) {
  const inventory = useGameStore((s) => s.inventory);
  const timeSiphonBonus = useGameStore((s) => s.timeSiphonBonus);
  const cascadeClockPct = useGameStore((s) => s.cascadeClockPct);

  const difficulty = getEffectiveDifficulty(floor, purchasedUpgrades["difficulty-reducer"] ?? 0);
  const timeLimit = getEffectiveTimeLimit(
    BASE_TIME_LIMITS[type],
    difficulty,
    floor,
    timeSiphonBonus,
    cascadeClockPct,
    purchasedUpgrades["delay-injector"] ?? 0,
  );
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

function ResultFlash({
  success,
  earnedCredits,
  hadSpeedBonus,
}: {
  success: boolean;
  earnedCredits: number;
  hadSpeedBonus: boolean;
}) {
  return (
    <div className="text-center select-none">
      <h2
        className={`text-5xl sm:text-7xl font-heading uppercase tracking-wider glitch-text ${
          success ? "text-cyber-cyan" : "text-cyber-magenta"
        }`}
      >
        {success ? "SUCCESS" : "FAILED"}
      </h2>
      {success && earnedCredits > 0 && (
        <p className="mt-3 text-cyber-green text-lg font-mono font-bold tracking-widest glitch-subtle">
          +{earnedCredits} CR
        </p>
      )}
      {success && hadSpeedBonus && (
        <p className="mt-1 text-cyber-green/60 text-xs font-mono uppercase tracking-widest">
          SPEED BONUS
        </p>
      )}
      <p className="mt-2 text-white/30 text-sm uppercase tracking-widest glitch-subtle">
        {success ? "BREACH COMPLETE" : "INTRUSION BLOCKED"}
      </p>
    </div>
  );
}

