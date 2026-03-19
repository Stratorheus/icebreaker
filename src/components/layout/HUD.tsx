import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/game-store";
import { Coins } from "lucide-react";

/**
 * Top bar HUD — visible during "playing", "shop", and "milestone" statuses.
 *
 * Layout:
 *  [ICEBREAKER v1.0]              [FLOOR n] [HP bar] [credits CR] [power-ups]
 *
 * No pause button — quit/codex/stats are accessible from the vendor node only.
 */
export function HUD() {
  const status = useGameStore((s) => s.status);
  const floor = useGameStore((s) => s.floor);
  const hp = useGameStore((s) => s.hp);
  const maxHp = useGameStore((s) => s.maxHp);
  const credits = useGameStore((s) => s.credits);
  const inventory = useGameStore((s) => s.inventory);

  const [showPowerUps, setShowPowerUps] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!showPowerUps) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPowerUps(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showPowerUps]);

  // Close popover on status change (e.g. entering a minigame)
  useEffect(() => {
    setShowPowerUps(false);
  }, [status]);

  // Only show during active gameplay / shop / milestone
  if (status !== "playing" && status !== "shop" && status !== "milestone") return null;

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
      <div className="flex items-center gap-2 glitch-flicker">
        <span className="text-cyber-cyan font-bold">ICE</span>
        <span className="text-cyber-magenta font-bold">BREAKER</span>
        <span className="text-white/30 text-[10px]">{`v${__APP_VERSION__}`}</span>
      </div>

      {/* Right: Stats */}
      <div className="flex items-center gap-4">
        {/* Floor */}
        <div className="flex items-center gap-1 text-cyber-cyan/80 glitch-subtle">
          <span aria-hidden="true">{"\u25C6"}</span>
          <span>FLOOR {floor}</span>
        </div>

        {/* HP bar */}
        <div className="flex items-center gap-1">
          <span className="text-white/50 glitch-subtle">HP</span>
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
            {hp}/{maxHp}
          </span>
        </div>

        {/* Credits */}
        <div className="flex items-center gap-1 glitch-subtle" style={{ color: "var(--color-currency-credits)" }}>
          <Coins size={14} />
          <span className="tabular-nums">
            {credits.toLocaleString()} CR
          </span>
        </div>

        {/* Power-up count with popover (only if any) */}
        {inventory.length > 0 && (
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setShowPowerUps((v) => !v)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 -my-0.5 rounded-sm transition-colors duration-150 cursor-pointer",
                showPowerUps
                  ? "bg-cyber-cyan/15 text-cyber-cyan"
                  : "text-cyber-cyan/60 hover:text-cyber-cyan hover:bg-cyber-cyan/10",
              )}
            >
              <span aria-hidden="true">{"\u26A1"}</span>
              <span>{inventory.length}</span>
            </button>

            {/* Power-up popover */}
            {showPowerUps && (
              <div
                className={cn(
                  "absolute right-0 top-full mt-2",
                  "w-64 max-h-80 overflow-y-auto",
                  "bg-cyber-bg/95 backdrop-blur-md",
                  "border border-cyber-cyan/20",
                  "shadow-lg shadow-cyber-cyan/5",
                  "z-50 p-2",
                )}
              >
                <p className="text-[9px] text-white/30 uppercase tracking-[0.2em] px-2 py-1 mb-1">
                  Active Power-ups
                </p>
                {inventory.map((pu) => (
                  <div
                    key={pu.id}
                    className="px-2 py-1.5 border-b border-white/5 last:border-b-0"
                  >
                    <p className="text-[11px] font-bold text-cyber-cyan uppercase tracking-wider">
                      {pu.name}
                    </p>
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      {pu.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
