import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import type { MinigameResult } from "@/types/minigame";
import type { MinigameType, PowerUpInstance } from "@/types/game";
import { getCredits, getDifficulty, getTimeLimit } from "@/data/balancing";
import { getMinigameDisplayName } from "@/data/minigame-names";
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
import { Defrag } from "@/components/minigames/Defrag";
import { NetworkTrace } from "@/components/minigames/NetworkTrace";
import {
  DataStreamPlaceholder,
  SignalEchoPlaceholder,
  ChecksumVerifyPlaceholder,
  PortScanPlaceholder,
  SubnetScanPlaceholder,
  CipherCrackV2Placeholder,
} from "@/components/minigames/PlaceholderGame";

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
  const [lastEarnedCredits, setLastEarnedCredits] = useState(0);
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
        setHintText(getMinigameHint(floorMinigames[currentMinigameIndex]));
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

      // Calculate credits earned for success flash display
      let earnedCredits = 0;
      if (result.success) {
        const diffReducerT = purchasedUpgrades["difficulty-reducer"] ?? 0;
        const diff = getDifficulty(floor) * Math.pow(0.95, diffReducerT);
        const creditTier = purchasedUpgrades["credit-multiplier"] ?? 0;
        const creditMul = 1 + creditTier * 0.1;
        const unlockedCount = useGameStore.getState().unlockedMinigames.length;
        const unlockBonus = Math.max(0, unlockedCount - 5) * 0.05; // STARTING_MINIGAMES = 5
        const totalMul = creditMul * (1 + unlockBonus);
        const base = getCredits(result.timeMs, diff);
        const speedTaxT = purchasedUpgrades["speed-tax"] ?? 0;
        const speedBonus = speedTaxT > 0 ? Math.round(base * speedTaxT * 0.05) : 0;
        earnedCredits = Math.round(base * totalMul) + speedBonus;
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
        // Also consume time-bonus power-ups that were active during this minigame.
        const currentInventory = useGameStore.getState().inventory;
        const toConsume = currentInventory.filter(
          (p) =>
            (p.effect.minigame && p.effect.minigame === result.minigame) ||
            p.effect.type === "time-bonus",
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
            bonusTimeSecs={floor === 1 ? bonusTimeSecs : 0}
            purchasedUpgrades={purchasedUpgrades}
            onComplete={handleComplete}
          />
        )}

        {phase === "result" && (
          <ResultFlash
            success={lastResult ?? false}
            earnedCredits={lastEarnedCredits}
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
        FLOOR {floor} // MINIGAME {index + 1} OF {total}
      </p>
      <h2 className="text-3xl sm:text-5xl font-bold uppercase tracking-wider text-cyber-cyan mb-8 glitch-text">
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
  "type-backward": 13,
  "match-arrows": 8,
  "find-symbol": 12,
  "mine-sweep": 15,
  "wire-cutting": 12,
  "cipher-crack": 12,
  "defrag": 30,
  "network-trace": 20,
  "data-stream": 25,
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
  "data-stream": DataStreamPlaceholder,
  "signal-echo": SignalEchoPlaceholder,
  "checksum-verify": ChecksumVerifyPlaceholder,
  "port-scan": PortScanPlaceholder,
  "subnet-scan": SubnetScanPlaceholder,
  "cipher-crack-v2": CipherCrackV2Placeholder,
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
      // arrow-preview → peek-ahead (1 / 2 / 3 arrows previewed)
      addIfOwned("arrow-preview", "peek-ahead", [1, 2, 3], "match-arrows");
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

  // Difficulty reducer (stackable): multiply by 0.95 per purchase (diminishing returns, never 0)
  const diffReducerTier = purchasedUpgrades["difficulty-reducer"] ?? 0;
  const difficulty = getDifficulty(floor) * Math.pow(0.95, diffReducerTier);

  // Timer extension (stackable): multiply by 1.03 per purchase (diminishing returns)
  const timerExtTier = purchasedUpgrades["timer-extension"] ?? 0;
  const baseTimeLimit = getTimeLimit(BASE_TIME_LIMITS[type], difficulty, floor) + bonusTimeSecs;
  const timeLimit = Math.round(baseTimeLimit * Math.pow(1.03, timerExtTier));
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
}: {
  success: boolean;
  earnedCredits: number;
}) {
  return (
    <div className="text-center select-none">
      <h2
        className={`text-5xl sm:text-7xl font-bold uppercase tracking-wider glitch-text ${
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
      <p className="mt-2 text-white/30 text-sm uppercase tracking-widest glitch-subtle">
        {success ? "BREACH COMPLETE" : "INTRUSION BLOCKED"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Brief contextual hint for each minigame type (shown when Hint Module is active). */
function getMinigameHint(type: MinigameType): string {
  switch (type) {
    case "slash-timing":
      return "Wait for the GREEN flash, then press Space.";
    case "close-brackets":
      return "Type closing brackets in REVERSE order.";
    case "type-backward":
      return "Read mirrored words, type the originals in order.";
    case "match-arrows":
      return "Press the arrow key that matches the revealed arrow.";
    case "find-symbol":
      return "Click/select each target symbol in order.";
    case "mine-sweep":
      return "Memorize mine positions during the preview phase.";
    case "wire-cutting":
      return "Cut wires in the order shown by the sequence.";
    case "cipher-crack":
      return "Reverse the letter shift to find the original word.";
    case "defrag":
      return "Uncover cells, avoid mines. Numbers show adjacent mine count.";
    case "network-trace":
      return "Navigate the maze from entry to target using arrow keys.";
    case "data-stream":
      return "Catch valid data packets, avoid corrupted ones.";
    case "signal-echo":
      return "Repeat the signal pattern in the correct sequence.";
    case "checksum-verify":
      return "Calculate and verify the checksum value.";
    case "port-scan":
      return "Identify the open ports from the scan results.";
    case "subnet-scan":
      return "Map the subnet by selecting active nodes.";
    case "cipher-crack-v2":
      return "Decode the advanced cipher using multiple layers.";
  }
}
