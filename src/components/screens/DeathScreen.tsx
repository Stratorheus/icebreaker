import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/game-store";
import { getDataReward } from "@/data/balancing";
import { awardNewAchievements } from "@/hooks/use-achievement-check";

/**
 * Death screen — shown when HP reaches 0.
 *
 * Displays run summary, awards persistent data, updates stats,
 * and provides a return-to-menu button.
 */
export function DeathScreen() {
  const setStatus = useGameStore((s) => s.setStatus);
  const addData = useGameStore((s) => s.addData);
  const updateStats = useGameStore((s) => s.updateStats);
  const stats = useGameStore((s) => s.stats);

  const floor = useGameStore((s) => s.floor);
  const minigamesPlayedThisRun = useGameStore(
    (s) => s.minigamesPlayedThisRun,
  );
  const minigamesWonThisRun = useGameStore((s) => s.minigamesWonThisRun);
  const runScore = useGameStore((s) => s.runScore);
  const runStartTime = useGameStore((s) => s.runStartTime);

  // Base run data reward (no milestone bonus — milestones are already
  // awarded during advanceFloor() so including them here double-counts)
  const baseDataEarned = getDataReward(floor);

  // Total data earned this run (base + achievement bonuses), updated after
  // awards are processed so the display reflects the real total.
  const [totalDataEarned, setTotalDataEarned] = useState(baseDataEarned);

  // Prevent double-award in React Strict Mode
  const awardedRef = useRef(false);

  useEffect(() => {
    if (awardedRef.current) return;
    awardedRef.current = true;

    // Snapshot data balance before awards
    const dataBefore = useGameStore.getState().data;

    // Award base run data to persistent store
    if (baseDataEarned > 0) {
      addData(baseDataEarned);
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
      totalDataEarned: stats.totalDataEarned + baseDataEarned,
      totalPlayTimeMs: stats.totalPlayTimeMs + playTimeMs,
    });

    // Check run-end achievements (total-runs, total-minigames) after stats
    // are updated. Zustand set() is synchronous so getState() is fresh.
    awardNewAchievements();

    // Calculate total data actually added (base + any achievement bonuses)
    const dataAfter = useGameStore.getState().data;
    setTotalDataEarned(dataAfter - dataBefore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-bold uppercase tracking-wider mb-2 text-cyber-magenta">
        CONNECTION LOST
      </h1>
      <p className="text-white/30 text-sm tracking-[0.2em] uppercase mb-10">
        {">"}_&nbsp;SYSTEM BREACH FAILED
      </p>

      {/* Run summary grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-10 text-sm uppercase tracking-widest">
        <SummaryRow label="FLOOR REACHED" value={String(floor)} />
        <SummaryRow
          label="MINIGAMES"
          value={`${minigamesWonThisRun} / ${minigamesPlayedThisRun}`}
        />
        <SummaryRow label="CREDITS EARNED" value={`${runScore} CR`} />
        <SummaryRow
          label="DATA EARNED"
          value={`${"\u25C6"} ${totalDataEarned}`}
          highlight
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
// Internal helper
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
