import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { getDataReward } from "@/data/balancing";
import { awardNewAchievements } from "@/hooks/use-achievement-check";

/**
 * Death screen — shown when HP reaches 0.
 *
 * Displays a detailed data breakdown:
 *   BASE DATA  /  CREDITS SAVED  /  ACHIEVEMENT BONUS  /  DEATH PENALTY  /  TOTAL
 *
 * Leftover credits convert to bonus data at 15% rate.
 * Awards persistent data (with death penalty), updates stats, return-to-menu.
 */
export function DeathScreen() {
  const setStatus = useGameStore((s) => s.setStatus);
  const addData = useGameStore((s) => s.addData);
  const updateStats = useGameStore((s) => s.updateStats);
  const stats = useGameStore((s) => s.stats);
  const purchasedUpgrades = useGameStore((s) => s.purchasedUpgrades);

  const floor = useGameStore((s) => s.floor);
  const minigamesPlayedThisRun = useGameStore(
    (s) => s.minigamesPlayedThisRun,
  );
  const minigamesWonThisRun = useGameStore((s) => s.minigamesWonThisRun);
  const runScore = useGameStore((s) => s.runScore);
  const credits = useGameStore((s) => s.credits);
  const runStartTime = useGameStore((s) => s.runStartTime);

  // Base run data reward (no milestone bonus — milestones are already
  // awarded during completeMinigame() so including them here double-counts)
  // 1c. Data Siphon meta upgrade: +10/20/30% data
  const dataTier = purchasedUpgrades["data-siphon"] ?? 0;
  const dataMultiplier = 1 + dataTier * 0.1;
  const baseDataEarned = Math.round(getDataReward(floor) * dataMultiplier);

  // Credits → Data conversion: leftover credits convert at 15% rate
  const creditsSaved = Math.floor(credits * 0.15);

  // Pre-penalty subtotal (base + credits saved)
  const prePenaltyData = baseDataEarned + creditsSaved;

  // Death penalty: lose 25% of earned data, reducible via Data Recovery
  // upgrade (3 tiers: -5%/-10%/-15% reduction -> 20%/15%/10% penalty)
  const dataRecoveryTier = purchasedUpgrades["data-recovery"] ?? 0;
  const penaltyPct = Math.max(0.10, 0.25 - dataRecoveryTier * 0.05);
  const penaltyAmount = Math.floor(prePenaltyData * penaltyPct);
  const dataAfterPenalty = prePenaltyData - penaltyAmount;

  // Achievement bonus is computed after awards run — initially 0, updated in useEffect.
  const [achievementBonus, setAchievementBonus] = useState(0);
  const [totalDataEarned, setTotalDataEarned] = useState(dataAfterPenalty);

  // Prevent double-award in React Strict Mode
  const awardedRef = useRef(false);

  useEffect(() => {
    if (awardedRef.current) return;
    awardedRef.current = true;

    // Snapshot data balance before awards
    const dataBefore = useGameStore.getState().data;

    // Award data with death penalty applied (includes creditsSaved)
    if (dataAfterPenalty > 0) {
      addData(dataAfterPenalty);
    }

    // Update stats
    const playTimeMs = Date.now() - runStartTime;
    updateStats({
      totalRuns: stats.totalRuns + 1,
      bestFloor: Math.max(stats.bestFloor, floor),
      totalMinigamesPlayed:
        stats.totalMinigamesPlayed + minigamesPlayedThisRun,
      totalMinigamesWon: stats.totalMinigamesWon + minigamesWonThisRun,
      totalCreditsEarned: stats.totalCreditsEarned + runScore,
      totalDataEarned: stats.totalDataEarned + dataAfterPenalty,
      totalPlayTimeMs: stats.totalPlayTimeMs + playTimeMs,
    });

    // Check run-end achievements (total-runs, total-minigames) after stats
    // are updated. Zustand set() is synchronous so getState() is fresh.
    awardNewAchievements();

    // Calculate total data actually added (base - penalty + achievement bonuses)
    const dataAfterAll = useGameStore.getState().data;
    const actualTotal = dataAfterAll - dataBefore;
    const achBonus = actualTotal - dataAfterPenalty;
    setAchievementBonus(Math.max(0, achBonus));
    setTotalDataEarned(actualTotal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-bold uppercase tracking-wider mb-2 text-cyber-magenta glitch-text-strong">
        CONNECTION LOST
      </h1>
      <p className="text-white/30 text-sm tracking-[0.2em] uppercase mb-8 glitch-subtle">
        {">"}_&nbsp;SYSTEM BREACH FAILED
      </p>

      {/* Run summary */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8 text-sm uppercase tracking-widest glitch-subtle">
        <SummaryRow label="FLOOR REACHED" value={String(floor)} />
        <SummaryRow
          label="MINIGAMES"
          value={`${minigamesWonThisRun}W / ${minigamesPlayedThisRun}P`}
        />
        <SummaryRow label="CREDITS EARNED" value={`${runScore} CR`} />
      </div>

      {/* Data breakdown */}
      <div className="w-full max-w-xs font-mono text-xs uppercase tracking-widest mb-8">
        <BreakdownRow label="BASE DATA" value={`${baseDataEarned}`} suffix={"\u25C6"} />
        {creditsSaved > 0 && (
          <BreakdownRow
            label="CREDITS SAVED"
            value={`+${creditsSaved}`}
            suffix={"\u25C6"}
            className="text-cyber-green/70"
          />
        )}
        {achievementBonus > 0 && (
          <BreakdownRow
            label="ACHIEVEMENT BONUS"
            value={`+${achievementBonus}`}
            suffix={"\u25C6"}
            className="text-cyber-cyan/70"
          />
        )}
        <BreakdownRow
          label={`DEATH PENALTY (${Math.round(penaltyPct * 100)}%)`}
          value={`-${penaltyAmount}`}
          suffix={"\u25C6"}
          className="text-cyber-magenta/70"
        />
        {dataRecoveryTier > 0 && (
          <p className="text-cyber-green/40 text-[10px] tracking-widest mt-0.5 mb-1 text-right">
            DATA RECOVERY LVL {dataRecoveryTier} ACTIVE
          </p>
        )}
        <div className="border-t border-white/10 my-2" />
        <BreakdownRow
          label="TOTAL"
          value={`${totalDataEarned}`}
          suffix={"\u25C6"}
          className="text-cyber-magenta font-bold text-sm"
        />
      </div>

      {/* Return button */}
      <button
        type="button"
        onClick={() => setStatus("menu")}
        className="
          py-3 px-8
          text-sm uppercase tracking-widest font-mono
          border border-cyber-cyan/40 text-cyber-cyan
          hover:bg-cyber-cyan/10 hover:border-cyber-cyan/70
          transition-colors duration-150
          cursor-pointer select-none
        "
      >
        {">"}_&nbsp;RETURN TO MENU
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <>
      <span className="text-white/40 text-right">{label}</span>
      <span
        className={
          highlight
            ? "text-cyber-magenta font-bold tabular-nums"
            : "text-white/80 tabular-nums"
        }
      >
        {value}
      </span>
    </>
  );
}

function BreakdownRow({
  label,
  value,
  suffix,
  className = "",
}: {
  label: string;
  value: string;
  suffix: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-between items-baseline py-0.5 ${className || "text-white/60"}`}>
      <span>{label}</span>
      <span className="tabular-nums">
        {value} {suffix}
      </span>
    </div>
  );
}
