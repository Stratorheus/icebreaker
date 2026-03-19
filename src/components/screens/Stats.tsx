import { useGameStore } from "@/store/game-store";
import { ACHIEVEMENT_POOL } from "@/data/achievements";
import type { PlayerStats } from "@/types/game";
import type { Achievement } from "@/types/shop";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPlayTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function calcWinRate(played: number, won: number): string {
  if (played === 0) return "—";
  return `${Math.round((won / played) * 100)}%`;
}

// ---------------------------------------------------------------------------
// Achievement progress
// ---------------------------------------------------------------------------

function getAchievementProgress(
  achievement: Achievement,
  stats: PlayerStats,
): { current: number; max: number } | null {
  const { condition } = achievement;
  if (condition.type === "total-runs") {
    return { current: Math.min(stats.totalRuns, condition.count), max: condition.count };
  }
  if (condition.type === "total-minigames") {
    return {
      current: Math.min(stats.totalMinigamesPlayed, condition.count),
      max: condition.count,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/40 text-xs uppercase tracking-widest">{label}</span>
      <span className="text-white/90 text-sm font-mono tabular-nums">{value}</span>
    </div>
  );
}

function ProgressBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className="mt-1.5 h-1 w-full bg-white/10 rounded-none overflow-hidden">
      <div
        className="h-full bg-cyber-cyan/60 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function AchievementCard({
  achievement,
  earned,
  stats,
}: {
  achievement: Achievement;
  earned: boolean;
  stats: PlayerStats;
}) {
  const progress = getAchievementProgress(achievement, stats);

  if (earned) {
    return (
      <div className="border border-cyber-cyan/20 bg-cyber-cyan/[0.03] p-3 flex items-start gap-3">
        <span className="text-cyber-cyan text-base select-none mt-0.5">◆</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-cyber-cyan text-xs font-bold uppercase tracking-wider">
              {achievement.name}
            </span>
            <span className="text-cyber-cyan/70 text-[10px] uppercase tracking-widest font-mono shrink-0">
              ◆ +{achievement.reward}
            </span>
          </div>
          <p className="text-white/40 text-[10px] mt-0.5 leading-relaxed">
            {achievement.description}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/5 bg-white/[0.01] p-3 flex items-start gap-3 opacity-50">
      <span className="text-white/20 text-base select-none mt-0.5">◇</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-white/30 text-xs font-bold uppercase tracking-wider">
            {achievement.name}
          </span>
          <span className="text-white/20 text-[10px] uppercase tracking-widest font-mono shrink-0">
            LOCKED
          </span>
        </div>
        <p className="text-white/20 text-[10px] mt-0.5">???</p>
        {progress && (
          <div className="mt-1">
            <ProgressBar current={progress.current} max={progress.max} />
            <p className="text-white/20 text-[10px] mt-0.5 tabular-nums">
              {progress.current} / {progress.max}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats screen
// ---------------------------------------------------------------------------

export function Stats({ onBack }: { onBack?: () => void } = {}) {
  const setStatus = useGameStore((s) => s.setStatus);
  const stats = useGameStore((s) => s.stats);
  const earnedIds = useGameStore((s) => s.achievements);
  const handleBack = onBack ?? (() => setStatus("menu"));

  const earnedSet = new Set(earnedIds);
  const earnedCount = earnedIds.length;
  const totalCount = ACHIEVEMENT_POOL.length;

  // Sort: earned first, then locked
  const sortedAchievements = [...ACHIEVEMENT_POOL].sort((a, b) => {
    const aEarned = earnedSet.has(a.id) ? 0 : 1;
    const bEarned = earnedSet.has(b.id) ? 0 : 1;
    return aEarned - bEarned;
  });

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-12 pb-16 overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mb-1">
          {">"}_&nbsp;OPERATOR DOSSIER
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wider text-cyber-cyan">
          SYSTEM LOGS
        </h1>
        <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1">
          PERSISTENT RECORD — ALL SESSIONS
        </p>
      </div>

      {/* Stats table */}
      <section className="w-full max-w-2xl border border-white/10 bg-white/[0.02] p-4 mb-6">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-4">
          {">"}_&nbsp;STATISTICS
        </h2>

        <div className="space-y-0">
          <StatRow label="Total Runs" value={String(stats.totalRuns)} />
          <StatRow label="Best Floor" value={stats.bestFloor > 0 ? `Floor ${stats.bestFloor}` : "—"} />
          <StatRow label="Minigames Played" value={String(stats.totalMinigamesPlayed)} />
          <StatRow label="Minigames Won" value={String(stats.totalMinigamesWon)} />
          <StatRow
            label="Win Rate"
            value={calcWinRate(stats.totalMinigamesPlayed, stats.totalMinigamesWon)}
          />
          <StatRow label="Credits Earned" value={`¢${stats.totalCreditsEarned}`} />
          <StatRow label="Data Earned" value={`◆ ${stats.totalDataEarned}`} />
          <StatRow label="Total Play Time" value={formatPlayTime(stats.totalPlayTimeMs)} />
        </div>
      </section>

      {/* Per-minigame win totals, if any recorded */}
      {Object.keys(stats.minigameWinsTotal).length > 0 && (
        <section className="w-full max-w-2xl border border-white/10 bg-white/[0.02] p-4 mb-6">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-4">
            {">"}_&nbsp;MINIGAME RECORD
          </h2>
          <div className="space-y-0">
            {(Object.entries(stats.minigameWinsTotal) as [string, number][]).map(
              ([type, wins]) => (
                <StatRow
                  key={type}
                  label={type.replace(/-/g, " ").toUpperCase()}
                  value={`${wins} win${wins !== 1 ? "s" : ""}`}
                />
              ),
            )}
          </div>
        </section>
      )}

      {/* Achievements */}
      <section className="w-full max-w-2xl">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            {">"}_&nbsp;ACHIEVEMENTS
          </h2>
          <span className="text-xs font-mono tabular-nums text-cyber-cyan/60">
            {earnedCount} / {totalCount}
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="mb-4 h-1 w-full bg-white/10">
          <div
            className="h-full bg-cyber-cyan/50 transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {sortedAchievements.map((achievement) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              earned={earnedSet.has(achievement.id)}
              stats={stats}
            />
          ))}
        </div>
      </section>

      {/* Back button */}
      <div className="w-full max-w-2xl mt-8">
        <button
          type="button"
          onClick={handleBack}
          className="
            py-2 px-6
            text-sm uppercase tracking-widest font-mono
            border border-white/15 text-white/40
            hover:bg-white/5 hover:text-white/70 hover:border-white/30
            transition-colors duration-150
            cursor-pointer select-none
          "
        >
          {">"}_&nbsp;{onBack ? "BACK TO VENDOR" : "BACK TO MENU"}
        </button>
      </div>
    </div>
  );
}
