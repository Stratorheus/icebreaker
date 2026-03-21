import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import type { MinigameResult } from "@/types/minigame";
import type { MinigameType, PowerUpInstance } from "@/types/game";
import { getEffectiveCredits, getEffectiveDifficulty, getEffectiveTimeLimit } from "@/data/balancing";
import { getMinigameDisplayName } from "@/data/minigame-names";
import { getMinigameHint } from "@/data/minigame-descriptions";
import { useTouchDevice } from "@/hooks/use-touch-device";
import { checkSkip } from "@/lib/power-up-effects";
import { META_UPGRADE_POOL } from "@/data/meta-upgrades";
import { awardNewAchievements } from "@/hooks/use-achievement-check";
import { SlashTiming } from "@/components/minigames/SlashTiming";
import { CloseBrackets } from "@/components/minigames/CloseBrackets";
import { TypeBackward } from "@/components/minigames/TypeBackward";
import { MatchArrows } from "@/components/minigames/MatchArrows";
import { FindSymbol } from "@/components/minigames/FindSymbol";
import { MineSweep } from "@/components/minigames/MineSweep";
import { WireCutting } from "@/components/minigames/WireCutting";
import { CipherCrack } from "@/components/minigames/CipherCrack";
import { Defrag } from "@/components/minigames/Defrag";
import { NetworkTrace } from "@/components/minigames/NetworkTrace";
import { SignalEcho } from "@/components/minigames/SignalEcho";
import { ChecksumVerify } from "@/components/minigames/ChecksumVerify";
import { PortScan } from "@/components/minigames/PortScan";
import { SubnetScan } from "@/components/minigames/SubnetScan";
import { CipherCrackV2 } from "@/components/minigames/CipherCrackV2";

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
  const isTouch = useTouchDevice();
  const recordMinigameResult = useGameStore((s) => s.recordMinigameResult);
  const skipRemainingFloor = useGameStore((s) => s.skipRemainingFloor);

  const currentMinigame = floorMinigames[currentMinigameIndex];

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdownValue, setCountdownValue] = useState(3);
  const [lastResult, setLastResult] = useState<boolean | null>(null);
  const [lastEarnedCredits, setLastEarnedCredits] = useState(0);
  const [lastHadSpeedBonus, setLastHadSpeedBonus] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);

  // Track the floorMinigames array reference to detect re-rolls (fail
  // replaces the entry at the same index, so the array ref changes).
  const prevIndexRef = useRef(currentMinigameIndex);
  const prevFloorMinigamesRef = useRef(floorMinigames);
  const hintConsumedRef = useRef(false);

  // Reset phase when minigame index changes (next minigame) OR when
  // floorMinigames array changes (re-roll after fail)
  useEffect(() => {
    if (
      prevIndexRef.current !== currentMinigameIndex ||
      prevFloorMinigamesRef.current !== floorMinigames
    ) {
      prevIndexRef.current = currentMinigameIndex;
      prevFloorMinigamesRef.current = floorMinigames;
      hintConsumedRef.current = false;

      // Check for run-shop hint power-up (not meta upgrade synthetics —
      // those have minigame-specific hints handled per-component)
      const hintPowerUp = inventory.find(
        (p) => p.effect.type === "hint" && !p.effect.minigame,
      );
      if (hintPowerUp) {
        // Consume the power-up and extend countdown by 1 tick
        hintConsumedRef.current = true;
        usePowerUp(hintPowerUp.id);
        setCountdownValue(4); // 4-3-2-1-GO instead of 3-2-1-GO
        setHintText(getMinigameHint(floorMinigames[currentMinigameIndex], isTouch));
      } else {
        setCountdownValue(3);
        setHintText(null);
      }

      setPhase("countdown");
      setLastResult(null);
    }
  }, [currentMinigameIndex, floorMinigames, inventory, usePowerUp]);

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
          // Warp Gate: skip entire remaining floor
          skipRemainingFloor(skipResult.rewardFraction);
          setLastResult(true);
          setPhase("result");
          return;
        }

        // Single protocol skip (Backdoor or Null Route)
        setLastResult(true);
        setPhase("result");
        setTimeout(() => {
          completeMinigame({
            success: true,
            timeMs: 0,
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
  }, [phase, countdownValue, inventory, usePowerUp, completeMinigame, currentMinigame, skipRemainingFloor]);

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
        const unlockBonus = Math.max(0, unlockedCount - 5) * 0.05; // STARTING_MINIGAMES = 5
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

        // Consume minigame-specific power-ups (e.g. arrow-compass, mine-detector,
        // slash-calibration, bracket-auto-close) — these should be one-use, not permanent.
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
        // (Zustand set() is synchronous so state is fresh here)
        awardNewAchievements({
          success: result.success,
          timeMs: result.timeMs,
          type: result.minigame,
        });
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
            hint={hintText}
          />
        )}

        {phase === "active" && (
          <MinigameRouter
            type={currentMinigame}
            floor={floor}
            purchasedUpgrades={purchasedUpgrades}
            onComplete={handleComplete}
          />
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
  hint,
}: {
  minigameName: string;
  value: number;
  floor: number;
  index: number;
  total: number;
  hint: string | null;
}) {
  return (
    <div className="text-center select-none">
      <p className="text-white/30 text-xs uppercase tracking-widest mb-4 glitch-subtle">
        FLOOR {floor} // PROTOCOL {index + 1} OF {total}
      </p>
      <h2 className="text-3xl sm:text-5xl font-heading uppercase tracking-wider text-cyber-cyan mb-8 glitch-text">
        {minigameName}
      </h2>
      {hint && (
        <p className="text-cyber-green text-sm font-mono tracking-wider mb-6 animate-pulse">
          HINT: {hint}
        </p>
      )}
      <p className="text-6xl sm:text-8xl font-bold text-white/80 tabular-nums glitch-flicker">
        {value > 0 ? value : "GO"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minigame router — renders the correct component by type
// ---------------------------------------------------------------------------

const BASE_TIME_LIMITS: Record<MinigameType, number> = {
  "slash-timing": 8,
  "close-brackets": 8,
  "type-backward": 18,
  "match-arrows": 8,
  "find-symbol": 12,
  "mine-sweep": 15,
  "wire-cutting": 12,
  "cipher-crack": 12,
  "defrag": 40,
  "network-trace": 20,
  "signal-echo": 20,
  "checksum-verify": 15,
  "port-scan": 15,
  "subnet-scan": 20,
  "cipher-crack-v2": 15,
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
  "defrag": Defrag,
  "network-trace": NetworkTrace,
  "signal-echo": SignalEcho,
  "checksum-verify": ChecksumVerify,
  "port-scan": PortScan,
  "subnet-scan": SubnetScan,
  "cipher-crack-v2": CipherCrackV2,
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
    const upgradeDef = META_UPGRADE_POOL.find((u) => u.id === upgradeId);
    synth.push({
      id: `meta-${upgradeId}`,
      type: `meta-${upgradeId}`,
      name: upgradeDef?.name ?? upgradeId,
      description: upgradeDef?.description ?? "",
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
      // mine-echo → mines-visible (20% / 35% / 50% of mines shown during preview)
      addIfOwned("mine-echo", "minigame-specific", [0.20, 0.35, 0.50], "mine-sweep");
      break;

    case "find-symbol":
      // symbol-scanner → hint (proximity blink)
      addIfOwned("symbol-scanner", "hint", [1], "find-symbol");
      // symbol-magnifier → minigame-specific (scale value 1.3)
      addIfOwned("symbol-magnifier", "minigame-specific", [1], "find-symbol");
      break;

    case "match-arrows":
      // arrow-preview → peek-ahead (15% / 25% / 40% of sequence previewed)
      addIfOwned("arrow-preview", "peek-ahead", [0.15, 0.25, 0.40], "match-arrows");
      break;

    case "type-backward":
      // type-assist → hint (first letter shown)
      addIfOwned("type-assist", "hint", [1], "type-backward");
      // reverse-trainer → minigame-specific (word length shown)
      addIfOwned("reverse-trainer", "minigame-specific", [1], "type-backward");
      break;

    case "wire-cutting":
      // wire-labels → hint (dims non-target, highlights next)
      addIfOwned("wire-labels", "hint", [1], "wire-cutting");
      break;

    case "cipher-crack":
      // cipher-hint → hint (extra letter)
      addIfOwned("cipher-hint", "hint", [1], "cipher-crack");
      break;

    case "slash-timing":
      // slash-window → window-extend (0.25 wider)
      addIfOwned("slash-window", "window-extend", [0.25], "slash-timing");
      break;

    case "defrag":
      break;

    case "network-trace":
      // network-trace-highlight → briefly flash correct path (1000ms)
      addIfOwned("network-trace-highlight", "minigame-specific", [1000], "network-trace");
      break;

    case "signal-echo":
      // signal-echo-slow → 30% slower display
      addIfOwned("signal-echo-slow", "minigame-specific", [0.3], "signal-echo");
      break;

    case "checksum-verify":
      // checksum-calculator → show intermediate hint
      addIfOwned("checksum-calculator", "minigame-specific", [1], "checksum-verify");
      break;

    case "port-scan":
      // port-scan-deep → flash twice
      addIfOwned("port-scan-deep", "minigame-specific", [2], "port-scan");
      break;

    case "subnet-scan":
      // subnet-cidr-helper → show expanded IP range
      addIfOwned("subnet-cidr-helper", "minigame-specific", [1], "subnet-scan");
      break;
  }

  return synth;
}

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// getMinigameHint is now imported from @/data/minigame-descriptions
