import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/game-store";

/**
 * Top bar HUD — visible during "playing" and "shop" statuses.
 *
 * Layout:
 *  [ICEBREAKER v1.0]                    [FLOOR n] [HP bar %] [credits CR]
 */
export function HUD() {
  const status = useGameStore((s) => s.status);
  const floor = useGameStore((s) => s.floor);
  const hp = useGameStore((s) => s.hp);
  const maxHp = useGameStore((s) => s.maxHp);
  const credits = useGameStore((s) => s.credits);
  const inventory = useGameStore((s) => s.inventory);

  // Only show during active gameplay / shop
  if (status !== "playing" && status !== "shop") return null;

  const hpPct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
  const hpBarFilled = Math.round(hpPct / 10);
  const hpBarEmpty = 10 - hpBarFilled;

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-40",
        "flex items-center justify-between",
        "h-10 px-4",
        "bg-cyber-bg/80 backdrop-blur-sm",
        "border-b border-cyber-cyan/15",
        "font-mono text-xs uppercase tracking-widest",
        "select-none",
      )}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <span className="text-cyber-cyan font-bold">ICE</span>
        <span className="text-cyber-magenta font-bold">BREAKER</span>
        <span className="text-white/30 text-[10px]">v1.0</span>
      </div>

      {/* Right: Stats */}
      <div className="flex items-center gap-4">
        {/* Floor */}
        <div className="flex items-center gap-1 text-cyber-cyan/80">
          <span aria-hidden="true">{"\u25C6"}</span>
          <span>FLOOR {floor}</span>
        </div>

        {/* HP bar */}
        <div className="flex items-center gap-1">
          <span className="text-white/50">HP</span>
          <span className="text-cyber-green">
            {"\u2588".repeat(hpBarFilled)}
          </span>
          <span className="text-white/20">
            {"\u2591".repeat(hpBarEmpty)}
          </span>
          <span
            className={cn(
              "tabular-nums",
              hpPct > 50
                ? "text-cyber-green"
                : hpPct > 25
                  ? "text-cyber-orange"
                  : "text-cyber-magenta",
            )}
          >
            {hpPct}%
          </span>
        </div>

        {/* Credits */}
        <div className="flex items-center gap-1 text-cyber-magenta">
          <span aria-hidden="true">{"\u2B26"}</span>
          <span className="tabular-nums">
            {credits.toLocaleString()} CR
          </span>
        </div>

        {/* Power-up count (only if any) */}
        {inventory.length > 0 && (
          <div className="flex items-center gap-1 text-cyber-cyan/60">
            <span aria-hidden="true">{"\u26A1"}</span>
            <span>{inventory.length}</span>
          </div>
        )}
      </div>
    </header>
  );
}
