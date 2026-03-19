import { useEffect } from "react";
import { useGameStore } from "@/store/game-store";

// ---------------------------------------------------------------------------
// Milestone text & subtitle per floor
// ---------------------------------------------------------------------------

const MILESTONE_DATA: Record<number, { title: string; subtitle: string }> = {
  5:  { title: "ICE LAYER 2 BREACHED",  subtitle: "SECONDARY FIREWALL COMPROMISED" },
  10: { title: "ICE LAYER 3 BREACHED",  subtitle: "TERTIARY DEFENSE CRUMBLING" },
  15: { title: "CORE ACCESS GRANTED",   subtitle: "NEURAL LATTICE EXPOSED" },
  20: { title: "SYSTEM COMPROMISED",    subtitle: "FULL INFILTRATION ACHIEVED" },
};

const MILESTONE_BONUS: Record<number, number> = {
  5: 50,
  10: 100,
  15: 200,
  20: 500,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full-screen milestone screen shown when the player completes a milestone
 * floor (5, 10, 15, 20). Dismisses on any keypress or click, then
 * transitions to the vendor/shop screen.
 */
export function MilestoneOverlay() {
  const milestoneFloor = useGameStore((s) => s.milestoneFloor);
  const dismissMilestone = useGameStore((s) => s.dismissMilestone);

  // Dismiss on any keypress
  useEffect(() => {
    if (milestoneFloor === 0) return;

    const handler = () => {
      dismissMilestone();
    };

    window.addEventListener("keydown", handler, { once: true });
    return () => window.removeEventListener("keydown", handler);
  }, [milestoneFloor, dismissMilestone]);

  if (milestoneFloor === 0) return null;

  const data = MILESTONE_DATA[milestoneFloor];
  if (!data) {
    // Unknown milestone floor — just dismiss to shop
    dismissMilestone();
    return null;
  }

  const bonus = MILESTONE_BONUS[milestoneFloor] ?? 0;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative"
      style={{ background: "rgba(0,0,0,0.88)" }}
      onClick={() => dismissMilestone()}
    >
      {/* Scanline decoration */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.015) 2px, rgba(0,255,255,0.015) 4px)",
        }}
      />

      {/* Floor badge */}
      <p className="text-xs uppercase tracking-[0.4em] text-white/30 mb-6 animate-pulse">
        FLOOR {milestoneFloor} MILESTONE
      </p>

      {/* Main title with glitch-like gradient */}
      <h1
        className="text-4xl sm:text-6xl md:text-7xl font-black uppercase text-center px-4 leading-none"
        style={{
          letterSpacing: "0.12em",
          background:
            "linear-gradient(135deg, #00ffff 0%, #ff00aa 50%, #00ffff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "milestone-flicker 0.15s steps(1) infinite",
          textShadow: "none",
        }}
      >
        {data.title}
      </h1>

      {/* Subtitle */}
      <p className="mt-4 text-sm sm:text-base uppercase tracking-[0.3em] text-white/40">
        {data.subtitle}
      </p>

      {/* Bonus data */}
      {bonus > 0 && (
        <div className="mt-8 flex items-center gap-2 border border-cyber-cyan/30 px-6 py-3">
          <span className="text-cyber-cyan text-2xl font-bold">{"\u25C6"}</span>
          <span className="text-cyber-cyan font-bold uppercase tracking-widest text-lg">
            +{bonus} DATA
          </span>
          <span className="text-white/30 text-xs uppercase tracking-wider ml-2">
            AWARDED
          </span>
        </div>
      )}

      {/* Dismiss hint */}
      <p className="mt-10 text-[10px] uppercase tracking-[0.4em] text-white/20">
        PRESS ANY KEY OR CLICK TO CONTINUE
      </p>

      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes milestone-flicker {
          0%   { opacity: 1; }
          92%  { opacity: 1; }
          93%  { opacity: 0.6; }
          94%  { opacity: 1; }
          96%  { opacity: 0.8; }
          97%  { opacity: 1; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
