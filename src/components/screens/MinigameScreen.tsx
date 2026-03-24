import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import type { MinigameResult } from "@/types/minigame";
import type { MinigameType } from "@/types/game";
import { getEffectiveCredits, getEffectiveDamage, getEffectiveDifficulty, getEffectiveTimeLimit, getDataDrip } from "@/data/balancing";
import { Coins, Hexagon } from "lucide-react";
import { MINIGAME_COMPONENTS, BASE_TIME_LIMITS, buildMetaPowerUps, STARTING_MINIGAMES, getMinigameDisplayName } from "@/data/minigames/registry";
import { checkSkip } from "@/lib/power-up-effects";
import { evaluateAndAwardAchievements } from "@/hooks/use-achievement-check";
import { ResultFlash } from "@/components/ui/ResultFlash";
import { CountdownDisplay } from "@/components/ui/CountdownDisplay";

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
            const rawCredits = getEffectiveCredits(Infinity, diff, purchasedUpgrades["credit-multiplier"] ?? 0, purchasedUpgrades["speed-tax"] ?? 0, unlockBonus, floor);
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
          const rawCredits = getEffectiveCredits(Infinity, diff, purchasedUpgrades["credit-multiplier"] ?? 0, purchasedUpgrades["speed-tax"] ?? 0, unlockBonus, floor);
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
          floor,
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
          <RunCountdownPhase
            minigameName={getMinigameDisplayName(currentMinigame)}
            value={countdownValue}
            floor={floor}
            index={currentMinigameIndex}
            total={floorMinigames.length}
            purchasedUpgrades={purchasedUpgrades}
            inventory={inventory}
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
            subtitle={lastResult ? "BREACH COMPLETE" : "INTRUSION BLOCKED"}
          >
            {lastResult && lastEarnedCredits > 0 && (
              <p className="mt-3 text-cyber-green text-lg font-mono font-bold tracking-widest glitch-subtle">
                +{lastEarnedCredits} CR
              </p>
            )}
            {lastResult && lastHadSpeedBonus && (
              <p className="mt-1 text-cyber-green/60 text-xs font-mono uppercase tracking-widest">
                SPEED BONUS
              </p>
            )}
          </ResultFlash>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Countdown phase — wraps shared CountdownDisplay with run-mode extras
// ---------------------------------------------------------------------------

function RunCountdownPhase({
  minigameName,
  value,
  floor,
  index,
  total,
  purchasedUpgrades,
  inventory,
}: {
  minigameName: string;
  value: number;
  floor: number;
  index: number;
  total: number;
  purchasedUpgrades: Record<string, number>;
  inventory: import("@/types/game").PowerUpInstance[];
}) {
  const diff = getEffectiveDifficulty(floor, purchasedUpgrades["difficulty-reducer"] ?? 0);
  const approxCredits = Math.round(20 * (1 + diff)) + floor * 2;
  const dataDrip = getDataDrip(floor);

  // Damage with all power-ups: meta armor + run-shop shields
  const baseDamage = getEffectiveDamage(floor, purchasedUpgrades["thicker-armor"] ?? 0);
  const fullShield = inventory.some((p) => p.effect.type === "shield");
  const reducer = inventory.find((p) => p.effect.type === "damage-reduction" || p.effect.type === "damage-reduction-stacked");
  const effectiveDamage = fullShield ? 0 : reducer ? Math.round(baseDamage * reducer.effect.value) : baseDamage;

  return (
    <CountdownDisplay
      title={minigameName}
      subtitle={`FLOOR ${floor} // PROTOCOL ${index + 1} OF ${total}`}
      value={value}
    >
      <div className="mt-4 flex items-center justify-center gap-4 text-[11px] font-mono uppercase tracking-wider">
        <span className="flex items-center gap-1 text-currency-credits">
          <Coins size={12} /> +{approxCredits}
        </span>
        <span className="flex items-center gap-1 text-currency-data">
          <Hexagon size={11} /> +{dataDrip}
        </span>
        <span className={`flex items-center gap-1 ${effectiveDamage === 0 ? "text-cyber-green/60" : "text-cyber-magenta/60"}`}>
          {effectiveDamage === 0 ? "SHIELDED" : `${effectiveDamage} HP`}
        </span>
      </div>
    </CountdownDisplay>
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


